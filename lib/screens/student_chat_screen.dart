import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import '../services/api_service.dart';

const Color chatPrimaryBlue = Color(0xFF2563EB);
const Color chatBackground = Color(0xFFF7F8FC);

class StudentChatScreen extends StatefulWidget {
  final int conversationId;
  final String boardingHouseName;
  final String ownerName;

  const StudentChatScreen({
    super.key,
    required this.conversationId,
    required this.boardingHouseName,
    this.ownerName = 'Boarding House Owner',
  });

  @override
  State<StudentChatScreen> createState() => _StudentChatScreenState();
}

class _StudentChatScreenState extends State<StudentChatScreen>
    with WidgetsBindingObserver {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<Map<String, dynamic>> _messages = [];

  final Map<int, Future<Uint8List?>> _attachmentImageFutures = {};

  Timer? _pollingTimer;

  bool _isLoading = true;
  bool _isSending = false;
  bool _isCheckingMessages = false;

  String? _errorMessage;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addObserver(this);

    _loadMessages();
    _startMessagePolling();
  }

  @override
  void dispose() {
    _stopMessagePolling();

    WidgetsBinding.instance.removeObserver(this);

    _messageController.dispose();
    _scrollController.dispose();

    super.dispose();
  }

  // HANDLE APP LIFECYCLE

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadMessages(showLoading: false);
      _startMessagePolling();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _stopMessagePolling();
    }
  }

  // START AUTOMATIC MESSAGE CHECKING

  void _startMessagePolling() {
    _stopMessagePolling();

    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted || _isLoading || _isCheckingMessages || _isSending) {
        return;
      }

      _loadMessages(showLoading: false, silent: true);
    });
  }

  // STOP AUTOMATIC MESSAGE CHECKING

  void _stopMessagePolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  // LOAD MESSAGES FROM LARAVEL

  Future<void> _loadMessages({
    bool showLoading = true,
    bool silent = false,
  }) async {
    if (!mounted || _isCheckingMessages) return;

    _isCheckingMessages = true;

    if (showLoading) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final result = await ApiService.getStudentConversationMessages(
        conversationId: widget.conversationId,
      );

      if (!mounted) return;

      if (result['success'] != true) {
        if (!silent) {
          setState(() {
            _isLoading = false;
            _errorMessage =
                result['message']?.toString() ?? 'Unable to load messages.';
          });
        }

        return;
      }

      final dynamic data = result['data'];

      final List<dynamic> records = data is List
          ? data
          : data is Map && data['data'] is List
          ? data['data']
          : [];

      final loadedMessages = records
          .whereType<Map>()
          .map((message) => Map<String, dynamic>.from(message))
          .toList();

      loadedMessages.sort((a, b) {
        final int idA = int.tryParse(a['id']?.toString() ?? '') ?? 0;
        final int idB = int.tryParse(b['id']?.toString() ?? '') ?? 0;

        return idA.compareTo(idB);
      });

      final previousLastId = _messages.isEmpty
          ? 0
          : int.tryParse(_messages.last['id']?.toString() ?? '') ?? 0;

      final newLastId = loadedMessages.isEmpty
          ? 0
          : int.tryParse(loadedMessages.last['id']?.toString() ?? '') ?? 0;

      final bool hasNewMessages = newLastId > previousLastId;

      setState(() {
        _messages = loadedMessages;
        _isLoading = false;
        _errorMessage = null;
      });

      await ApiService.markStudentConversationAsRead(
        conversationId: widget.conversationId,
      );

      if (!mounted) return;

      if (hasNewMessages || showLoading) {
        _scrollToBottom();
      }
    } catch (e) {
      if (!mounted) return;

      if (!silent) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Unable to load messages. Please try again.';
        });
      }
    } finally {
      _isCheckingMessages = false;
    }
  }

  // SEND MESSAGE

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();

    if (message.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });

    try {
      final result = await ApiService.sendStudentMessage(
        conversationId: widget.conversationId,
        message: message,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        _messageController.clear();

        await _loadMessages(showLoading: false);

        if (!mounted) return;

        setState(() {
          _isSending = false;
        });

        _scrollToBottom();
      } else {
        setState(() {
          _isSending = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result['message']?.toString() ?? 'Failed to send message.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSending = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to send message. Please try again.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  // LOAD IMAGE ATTACHMENT FROM LARAVEL

  Future<Uint8List?> _loadAttachmentImage(int attachmentId) {
    return _attachmentImageFutures.putIfAbsent(
      attachmentId,
      () => ApiService.getStudentMessageAttachment(
        conversationId: widget.conversationId,
        attachmentId: attachmentId,
      ),
    );
  }

  // DISPLAY FULL-SCREEN IMAGE

  void _showFullImage(Uint8List imageBytes) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.black,
          insetPadding: const EdgeInsets.all(12),
          child: Stack(
            children: [
              InteractiveViewer(
                minScale: 0.5,
                maxScale: 4,
                child: Center(
                  child: Image.memory(imageBytes, fit: BoxFit.contain),
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // BUILD ATTACHMENT

  Widget _buildAttachment(Map file, bool isMine) {
    final int attachmentId = int.tryParse(file['id']?.toString() ?? '') ?? 0;

    final String filename =
        file['original_filename']?.toString() ?? 'Attachment';

    final String mimeType = file['mime_type']?.toString() ?? '';

    final bool isImage = mimeType.startsWith('image/');

    // NON-IMAGE ATTACHMENTS

    if (!isImage || attachmentId <= 0) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              mimeType == 'application/pdf'
                  ? Icons.picture_as_pdf
                  : Icons.attach_file,
              size: 18,
              color: isMine ? Colors.white : chatPrimaryBlue,
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                filename,
                style: TextStyle(
                  color: isMine ? Colors.white : chatPrimaryBlue,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      );
    }

    // IMAGE ATTACHMENTS

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: FutureBuilder<Uint8List?>(
        future: _loadAttachmentImage(attachmentId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Container(
              width: 210,
              height: 150,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const CircularProgressIndicator(color: chatPrimaryBlue),
            );
          }

          if (!snapshot.hasData || snapshot.data == null) {
            return Container(
              width: 210,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.broken_image_outlined, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Could not load $filename',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            );
          }

          final Uint8List imageBytes = snapshot.data!;

          return GestureDetector(
            onTap: () => _showFullImage(imageBytes),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.memory(
                imageBytes,
                width: 210,
                height: 180,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return const SizedBox(
                    width: 210,
                    height: 150,
                    child: Center(
                      child: Icon(Icons.broken_image, color: Colors.red),
                    ),
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }

  // SCROLL TO THE LATEST MESSAGE

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  // FORMAT MESSAGE TIME

  String _formatTime(dynamic value) {
    if (value == null) return '';

    final date = DateTime.tryParse(value.toString());

    if (date == null) return '';

    final localDate = date.toLocal();
    final hour = localDate.hour % 12 == 0 ? 12 : localDate.hour % 12;
    final minute = localDate.minute.toString().padLeft(2, '0');
    final period = localDate.hour >= 12 ? 'PM' : 'AM';

    return '$hour:$minute $period';
  }

  // CHECK WHETHER THE MESSAGE BELONGS TO THE STUDENT

  bool _isMyMessage(Map<String, dynamic> message) {
    final dynamic sender = message['sender'];

    if (sender is Map) {
      return sender['role']?.toString() == 'student';
    }

    return false;
  }

  // MESSAGE BUBBLE

  Widget _buildMessageBubble(Map<String, dynamic> message) {
    final bool isMine = _isMyMessage(message);
    final String body = message['body']?.toString() ?? '';
    final String time = _formatTime(message['created_at']);

    final dynamic attachments = message['attachments'];
    final List<dynamic> files = attachments is List ? attachments : [];

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMine ? chatPrimaryBlue : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMine ? 16 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 16),
          ),
          border: isMine ? null : Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (body.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  body,
                  style: TextStyle(
                    color: isMine ? Colors.white : const Color(0xFF1F2937),
                    fontSize: 15,
                    height: 1.4,
                  ),
                ),
              ),

            if (files.isNotEmpty)
              ...files.map((file) {
                if (file is! Map) {
                  return const SizedBox.shrink();
                }

                return _buildAttachment(file, isMine);
              }),

            const SizedBox(height: 5),

            Text(
              time,
              style: TextStyle(
                color: isMine ? Colors.white70 : const Color(0xFF9CA3AF),
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // EMPTY CHAT VIEW

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 75,
              height: 75,
              decoration: BoxDecoration(
                color: chatPrimaryBlue.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                color: chatPrimaryBlue,
                size: 35,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Start a conversation',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1F2937),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Send a message to the boarding house owner to ask about availability, pricing, or other details.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF6B7280),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // MESSAGE INPUT AREA

  Widget _buildMessageInput() {
    return Container(
      padding: EdgeInsets.only(
        left: 14,
        right: 14,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom > 0 ? 12 : 16,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                minLines: 1,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  filled: true,
                  fillColor: chatBackground,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 9),
            SizedBox(
              height: 48,
              width: 48,
              child: ElevatedButton(
                onPressed: _isSending ? null : _sendMessage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: chatPrimaryBlue,
                  foregroundColor: Colors.white,
                  shape: const CircleBorder(),
                  padding: EdgeInsets.zero,
                ),
                child: _isSending
                    ? const SizedBox(
                        height: 19,
                        width: 19,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: chatBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1F2937),
        elevation: 0,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.ownerName,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            Text(
              widget.boardingHouseName,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: chatPrimaryBlue),
                  )
                : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.wifi_off_rounded,
                            size: 45,
                            color: Colors.grey,
                          ),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, textAlign: TextAlign.center),
                          const SizedBox(height: 15),
                          ElevatedButton(
                            onPressed: _loadMessages,
                            child: const Text('Try Again'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _messages.isEmpty
                ? RefreshIndicator(
                    onRefresh: () => _loadMessages(showLoading: false),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.55,
                          child: _buildEmptyState(),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () => _loadMessages(showLoading: false),
                    child: ListView.builder(
                      controller: _scrollController,
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        return _buildMessageBubble(_messages[index]);
                      },
                    ),
                  ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }
}
