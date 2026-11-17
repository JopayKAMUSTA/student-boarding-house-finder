import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'rental_payments_screen.dart';

const Color _primaryBlue = Color(0xFF2563EB);
const Color _pageBackground = Color(0xFFF7F8FC);

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  bool _isMarkingAll = false;
  String? _errorMessage;

  int _unreadCount = 0;
  List<Map<String, dynamic>> _notifications = [];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await ApiService.getStudentNotifications();

      if (!mounted) return;

      if (result['success'] == true) {
        final dynamic rawData = result['data'];
        final dynamic records = rawData is Map ? rawData['data'] : rawData;

        final notifications = records is List
            ? records
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : <Map<String, dynamic>>[];

        setState(() {
          _notifications = notifications;
          _unreadCount =
              int.tryParse(result['unread_count']?.toString() ?? '0') ?? 0;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage =
              result['message']?.toString() ?? 'Unable to load notifications.';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _errorMessage = 'Unable to load notifications. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _openNotification(Map<String, dynamic> notification) async {
    final dynamic rawData = notification['data'];

    final Map<String, dynamic> data = rawData is Map
        ? Map<String, dynamic>.from(rawData)
        : <String, dynamic>{};

    final isRentalBill =
        data['type']?.toString() == 'rental_bill' ||
        data['screen']?.toString() == 'rental_payments';

    // Mark unread notification as read first.
    if (notification['read_at'] == null) {
      final id = notification['id']?.toString();

      if (id == null || id.isEmpty) {
        _showMessage('Invalid notification.');
        return;
      }

      try {
        final result = await ApiService.markStudentNotificationAsRead(
          notificationId: id,
        );

        if (!mounted) return;

        if (result['success'] != true) {
          _showMessage(
            result['message']?.toString() ?? 'Unable to update notification.',
          );
          return;
        }

        setState(() {
          notification['read_at'] = DateTime.now().toIso8601String();

          if (_unreadCount > 0) {
            _unreadCount--;
          }
        });
      } catch (e) {
        if (!mounted) return;
        _showMessage('Unable to update notification. Please try again.');
        return;
      }
    }

    if (!mounted) return;

    // Rental bill notifications open the Rental Payments screen.
    if (isRentalBill) {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const RentalPaymentsScreen()),
      );

      return;
    }

    // Other notifications continue showing their details.
    _showNotificationDetails(notification);
  }

  Future<void> _markAllAsRead() async {
    if (_unreadCount == 0 || _isMarkingAll) return;

    setState(() {
      _isMarkingAll = true;
    });

    try {
      final result = await ApiService.markAllStudentNotificationsAsRead();

      if (!mounted) return;

      if (result['success'] == true) {
        setState(() {
          _unreadCount = 0;

          for (final notification in _notifications) {
            notification['read_at'] ??= DateTime.now().toIso8601String();
          }

          _isMarkingAll = false;
        });

        _showMessage('All notifications marked as read.');
      } else {
        setState(() {
          _isMarkingAll = false;
        });

        _showMessage(
          result['message']?.toString() ??
              'Unable to mark notifications as read.',
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isMarkingAll = false;
      });

      _showMessage('Unable to mark notifications as read.');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _showNotificationDetails(Map<String, dynamic> notification) {
    final dynamic rawData = notification['data'];

    final Map<String, dynamic> data = rawData is Map
        ? Map<String, dynamic>.from(rawData)
        : <String, dynamic>{};

    final title = data['title']?.toString() ?? 'Notification';
    final message =
        data['message']?.toString() ?? 'You have a new notification.';

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Text(title),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(message),
                if (data['boarding_house_name'] != null) ...[
                  const SizedBox(height: 16),
                  _detailRow(
                    'Boarding house',
                    data['boarding_house_name'].toString(),
                  ),
                ],
                if (data['room_number'] != null)
                  _detailRow('Room', data['room_number'].toString()),
                if (data['move_in_date'] != null)
                  _detailRow('Move-in date', data['move_in_date'].toString()),
                if (data['monthly_rent'] != null)
                  _detailRow('Monthly rent', '₱${data['monthly_rent']}'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 115,
            child: Text(
              label,
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(dynamic value) {
    if (value == null) return '';

    final date = DateTime.tryParse(value.toString());

    if (date == null) return '';

    final localDate = date.toLocal();

    return '${localDate.day.toString().padLeft(2, '0')}/'
        '${localDate.month.toString().padLeft(2, '0')}/'
        '${localDate.year} · '
        '${localDate.hour.toString().padLeft(2, '0')}:'
        '${localDate.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF172033),
          ),
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _isMarkingAll ? null : _markAllAsRead,
              child: _isMarkingAll
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text(
                      'Mark all read',
                      style: TextStyle(
                        color: _primaryBlue,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: _primaryBlue,
        onRefresh: _loadNotifications,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 180),
          Center(child: CircularProgressIndicator(color: _primaryBlue)),
        ],
      );
    }

    if (_errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 100),
          const Icon(
            Icons.notifications_off_outlined,
            size: 55,
            color: Colors.grey,
          ),
          const SizedBox(height: 16),
          Text(_errorMessage!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton.icon(
              onPressed: _loadNotifications,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ),
        ],
      );
    }

    if (_notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 130),
          Icon(Icons.notifications_none_rounded, size: 70, color: Colors.grey),
          SizedBox(height: 16),
          Center(
            child: Text(
              'No notifications yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF172033),
              ),
            ),
          ),
          SizedBox(height: 8),
          Center(
            child: Text(
              'Updates about your room and account will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _notifications.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final notification = _notifications[index];

        final dynamic rawData = notification['data'];

        final Map<String, dynamic> data = rawData is Map
            ? Map<String, dynamic>.from(rawData)
            : <String, dynamic>{};

        final title = data['title']?.toString() ?? 'Notification';
        final message =
            data['message']?.toString() ?? 'You have a new notification.';

        final isUnread = notification['read_at'] == null;
        final isRentalBill =
            data['type']?.toString() == 'rental_bill' ||
            data['screen']?.toString() == 'rental_payments';

        final date = _formatDate(notification['created_at']);

        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => _openNotification(notification),
            child: Padding(
              padding: const EdgeInsets.all(15),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF0FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      isRentalBill
                          ? Icons.receipt_long_outlined
                          : Icons.notifications_active_outlined,
                      color: _primaryBlue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Color(0xFF172033),
                                ),
                              ),
                            ),
                            if (isUnread)
                              Container(
                                width: 9,
                                height: 9,
                                decoration: const BoxDecoration(
                                  color: _primaryBlue,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          message,
                          style: const TextStyle(
                            color: Colors.black54,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                        if (date.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            date,
                            style: const TextStyle(
                              color: Colors.grey,
                              fontSize: 11,
                            ),
                          ),
                        ],
                        if (isRentalBill) ...[
                          const SizedBox(height: 7),
                          const Text(
                            'Tap to view rental payments',
                            style: TextStyle(
                              color: _primaryBlue,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
