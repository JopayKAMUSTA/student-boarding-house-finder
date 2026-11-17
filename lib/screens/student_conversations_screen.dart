
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'student_chat_screen.dart';

const Color messagesBlue = Color(0xFF2563EB);
const Color messagesBackground = Color(0xFFF7F8FC);

class StudentConversationsScreen extends StatefulWidget {
  const StudentConversationsScreen({super.key});

  @override
  State<StudentConversationsScreen> createState() =>
      _StudentConversationsScreenState();
}

class _StudentConversationsScreenState
    extends State<StudentConversationsScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  List<Map<String, dynamic>> _conversations = [];

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.getStudentConversations();

    if (!mounted) return;

    if (result['success'] == true) {
      final dynamic rawData = result['data'];

      final List<dynamic> records = rawData is List
          ? rawData
          : rawData is Map && rawData['data'] is List
              ? rawData['data']
              : [];

      setState(() {
        _conversations = records
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage =
            result['message'] ?? 'Unable to load your messages.';
        _isLoading = false;
      });
    }
  }

  String _getOwnerName(Map<String, dynamic> conversation) {
    final owner = conversation['owner'];

    if (owner is Map) {
      return (owner['name'] ?? 'Boarding House Owner').toString();
    }

    return 'Boarding House Owner';
  }

  String _getHouseName(Map<String, dynamic> conversation) {
    final house = conversation['boarding_house'];

    if (house is Map) {
      return (house['name'] ?? 'Boarding House').toString();
    }

    return 'Boarding House';
  }

  String _getLastMessage(Map<String, dynamic> conversation) {
    final message = conversation['latest_message'];

    if (message is Map) {
      final body = (message['body'] ?? '').toString();

      if (body.isNotEmpty) return body;

      if (message['attachments'] is List &&
          (message['attachments'] as List).isNotEmpty) {
        return 'Sent an attachment';
      }
    }

    return 'Start a conversation';
  }

  Future<void> _openConversation(
    Map<String, dynamic> conversation,
  ) async {
    final id = int.tryParse(conversation['id']?.toString() ?? '');

    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid conversation.')),
      );
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StudentChatScreen(
          conversationId: id,
          boardingHouseName: _getHouseName(conversation),
          ownerName: _getOwnerName(conversation),
        ),
      ),
    );

    if (!mounted) return;
    _loadConversations();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: messagesBackground,
      appBar: AppBar(
        title: const Text(
          'Messages',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loadConversations,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh messages',
          ),
        ],
      ),
      body: RefreshIndicator(
        color: messagesBlue,
        onRefresh: _loadConversations,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: messagesBlue),
      );
    }

    if (_errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          const Icon(Icons.wifi_off_rounded, size: 55, color: Colors.grey),
          const SizedBox(height: 12),
          Center(child: Text(_errorMessage!)),
          Center(
            child: TextButton(
              onPressed: _loadConversations,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    if (_conversations.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 130),
          Icon(
            Icons.chat_bubble_outline_rounded,
            size: 65,
            color: Colors.grey,
          ),
          SizedBox(height: 16),
          Center(
            child: Text(
              'No messages yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          SizedBox(height: 8),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 35),
            child: Text(
              'Your conversations with boarding house owners will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _conversations.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final conversation = _conversations[index];

        final unreadCount =
            int.tryParse(conversation['unread_count']?.toString() ?? '0') ??
                0;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(15),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 15,
              vertical: 8,
            ),
            leading: const CircleAvatar(
              radius: 25,
              backgroundColor: Color(0xFFE8EEFF),
              child: Icon(
                Icons.home_work_outlined,
                color: messagesBlue,
              ),
            ),
            title: Text(
              _getOwnerName(conversation),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 3),
                Text(
                  _getHouseName(conversation),
                  style: const TextStyle(
                    color: messagesBlue,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _getLastMessage(conversation),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            trailing: unreadCount > 0
                ? CircleAvatar(
                    radius: 12,
                    backgroundColor: messagesBlue,
                    child: Text(
                      unreadCount.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.grey,
                  ),
            onTap: () => _openConversation(conversation),
          ),
        );
      },
    );
  }
}
