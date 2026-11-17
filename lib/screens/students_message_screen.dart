import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'student_chat_screen.dart';

const Color messagesBlue = Color(0xFF2563EB);
const Color messagesBackground = Color(0xFFF7F8FC);

class StudentMessagesScreen extends StatefulWidget {
  const StudentMessagesScreen({super.key});

  @override
  State<StudentMessagesScreen> createState() =>
      _StudentMessagesScreenState();
}

class _StudentMessagesScreenState extends State<StudentMessagesScreen> {
  bool isLoading = true;
  String? errorMessage;

  List<Map<String, dynamic>> conversations = [];

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    if (!mounted) return;

    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    final result = await ApiService.getStudentConversations();

    if (!mounted) return;

    if (result['success'] == true) {
      final rawData = result['data'];

      dynamic conversationList;

      if (rawData is List) {
        conversationList = rawData;
      } else if (rawData is Map) {
        conversationList = rawData['data'];
      }

      final items = conversationList is List
          ? conversationList
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : <Map<String, dynamic>>[];

      setState(() {
        conversations = items;
        isLoading = false;
      });
    } else {
      setState(() {
        errorMessage =
            result['message'] ?? 'Unable to load your messages.';
        isLoading = false;
      });
    }
  }

  String _getHouseName(Map<String, dynamic> conversation) {
    final house = conversation['boarding_house'];

    if (house is Map) {
      return (house['name'] ?? 'Boarding House').toString();
    }

    return 'Boarding House';
  }

  String _getOwnerName(Map<String, dynamic> conversation) {
    final owner = conversation['owner'];

    if (owner is Map && owner['name'] != null) {
      return owner['name'].toString();
    }

    final house = conversation['boarding_house'];

    if (house is Map && house['owner'] is Map) {
      final houseOwner = house['owner'];

      return (houseOwner['name'] ?? 'Boarding House Owner').toString();
    }

    return 'Boarding House Owner';
  }

  String _getLatestMessage(Map<String, dynamic> conversation) {
    final message = conversation['latest_message'];

    if (message is Map) {
      final body = (message['body'] ?? '').toString().trim();

      if (body.isNotEmpty) {
        return body;
      }

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
    final conversationId = int.tryParse(
      conversation['id']?.toString() ?? '',
    );

    if (conversationId == null) {
      _showMessage('Invalid conversation.');
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StudentChatScreen(
          conversationId: conversationId,
          boardingHouseName: _getHouseName(conversation),
          ownerName: _getOwnerName(conversation),
        ),
      ),
    );

    if (!mounted) return;

    _loadConversations();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
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
    if (isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: messagesBlue),
      );
    }

    if (errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 100),
          const Icon(Icons.wifi_off_rounded, size: 50, color: Colors.grey),
          const SizedBox(height: 12),
          Center(
            child: Text(
              errorMessage!,
              textAlign: TextAlign.center,
            ),
          ),
          Center(
            child: TextButton(
              onPressed: _loadConversations,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    if (conversations.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 120),
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
          Center(
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
      itemCount: conversations.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final conversation = conversations[index];

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(15),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 8,
            ),
            leading: const CircleAvatar(
              radius: 25,
              backgroundColor: Color(0xFFE8EEFF),
              child: Icon(
                Icons.house_rounded,
                color: messagesBlue,
              ),
            ),
            title: Text(
              _getHouseName(conversation),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                '${_getOwnerName(conversation)}\n${_getLatestMessage(conversation)}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            isThreeLine: true,
            trailing: const Icon(
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