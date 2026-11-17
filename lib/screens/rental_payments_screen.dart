import 'dart:typed_data';

import 'package:file_picker/file_picker.dart' as file_picker;
import 'package:flutter/material.dart';

import '../services/api_service.dart';

const Color paymentBlue = Color(0xFF2563EB);
const Color paymentBackground = Color(0xFFF7F8FC);
const Color paymentText = Color(0xFF172033);
const Color paymentBorder = Color(0xFFEEF0F5);

class RentalPaymentsScreen extends StatefulWidget {
  const RentalPaymentsScreen({super.key});

  @override
  State<RentalPaymentsScreen> createState() => _RentalPaymentsScreenState();
}

class _RentalPaymentsScreenState extends State<RentalPaymentsScreen> {
  bool isLoading = true;
  String? errorMessage;
  List<Map<String, dynamic>> bills = [];

  @override
  void initState() {
    super.initState();
    loadBills();
  }

  Future<void> loadBills() async {
    if (mounted) {
      setState(() {
        isLoading = true;
        errorMessage = null;
      });
    }

    final result = await ApiService.getStudentRentalBills();

    if (!mounted) return;

    if (result['success'] == true) {
      final rawBills = result['data'];

      setState(() {
        bills = rawBills is List
            ? rawBills
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        isLoading = false;
      });
    } else {
      setState(() {
        errorMessage =
            result['message']?.toString() ?? 'Unable to load rental bills.';
        isLoading = false;
      });
    }
  }

  String money(dynamic value) {
    final amount = double.tryParse(value?.toString() ?? '') ?? 0;
    return '₱${amount.toStringAsFixed(2)}';
  }

  String dateText(dynamic value) {
    if (value == null || value.toString().isEmpty) {
      return 'Not available';
    }

    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();

    return '${parsed.day.toString().padLeft(2, '0')}/'
        '${parsed.month.toString().padLeft(2, '0')}/'
        '${parsed.year}';
  }

  String statusText(dynamic value) {
    switch (value?.toString().toLowerCase()) {
      case 'paid':
        return 'Paid';
      case 'overdue':
        return 'Overdue';
      case 'partially_paid':
        return 'Partially paid';
      case 'unpaid':
        return 'Unpaid';
      default:
        return 'Pending';
    }
  }

  Color statusColor(dynamic value) {
    switch (value?.toString().toLowerCase()) {
      case 'paid':
        return Colors.green;
      case 'overdue':
        return Colors.red;
      case 'partially_paid':
        return Colors.orange;
      default:
        return paymentBlue;
    }
  }

  List<Map<String, dynamic>> get allPayments {
    final result = <Map<String, dynamic>>[];

    for (final bill in bills) {
      final payments = bill['payments'];

      if (payments is List) {
        for (final payment in payments) {
          if (payment is Map) {
            result.add({
              ...Map<String, dynamic>.from(payment),
              'bill_id': bill['id'],
              'bill_due_date': bill['due_date'],
            });
          }
        }
      }
    }

    result.sort((a, b) {
      return (b['created_at'] ?? '').toString().compareTo(
        (a['created_at'] ?? '').toString(),
      );
    });

    return result;
  }

  Future<void> openBill(Map<String, dynamic> bill) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RentalBillDetailsScreen(
          bill: bill,
          money: money,
          dateText: dateText,
        ),
      ),
    );

    if (!mounted) return;
    await loadBills();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: paymentBackground,
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: paymentText,
          elevation: 0,
          title: const Text(
            'Rental Payments',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          bottom: const TabBar(
            labelColor: paymentBlue,
            unselectedLabelColor: Colors.grey,
            indicatorColor: paymentBlue,
            tabs: [
              Tab(text: 'My Bills', icon: Icon(Icons.receipt_long_outlined)),
              Tab(text: 'Payment History', icon: Icon(Icons.history_rounded)),
            ],
          ),
        ),
        body: TabBarView(children: [_buildBillsTab(), _buildHistoryTab()]),
      ),
    );
  }

  Widget _buildBillsTab() {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator(color: paymentBlue));
    }

    if (errorMessage != null) {
      return _messageState(
        Icons.wifi_off_rounded,
        errorMessage!,
        action: TextButton(
          onPressed: loadBills,
          child: const Text('Try again'),
        ),
      );
    }

    if (bills.isEmpty) {
      return _messageState(
        Icons.receipt_long_outlined,
        'No rental bills found yet.',
      );
    }

    return RefreshIndicator(
      color: paymentBlue,
      onRefresh: loadBills,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCard(),
          const SizedBox(height: 18),
          const Text(
            'Your rental bills',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: paymentText,
            ),
          ),
          const SizedBox(height: 12),
          ...bills.map(_billCard),
        ],
      ),
    );
  }

  Widget _summaryCard() {
    final outstanding = bills.fold<double>(0, (total, bill) {
      final amount =
          double.tryParse(bill['total_outstanding']?.toString() ?? '0') ?? 0;
      return total + amount;
    });

    final pendingCount = allPayments
        .where((payment) => payment['status'] == 'pending')
        .length;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: paymentBlue,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Total outstanding balance',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 7),
          Text(
            money(outstanding),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 27,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '${bills.length} bills • $pendingCount payment submissions awaiting review',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _billCard(Map<String, dynamic> bill) {
    final status = bill['payment_status'];
    final outstanding = bill['total_outstanding'] ?? bill['balance'] ?? '0';

    final assignment = bill['room_assignment'];
    final room = assignment is Map ? assignment['boarding_house_room'] : null;
    final house = room is Map ? room['boarding_house'] : null;

    final houseName = house is Map
        ? house['name']?.toString() ?? 'Boarding house'
        : 'Boarding house';

    final isVoided = bill['is_voided'] == true;

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: paymentBorder),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => openBill(bill),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.home_work_outlined, color: paymentBlue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      houseName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  _statusBadge(
                    isVoided ? 'Voided' : statusText(status),
                    isVoided ? Colors.grey : statusColor(status),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _infoRow('Due date', dateText(bill['due_date'])),
              _infoRow('Bill amount', money(bill['amount'])),
              _infoRow('Amount paid', money(bill['amount_paid'])),
              const Divider(height: 22),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Outstanding',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    money(outstanding),
                    style: const TextStyle(
                      color: paymentBlue,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'View details',
                    style: TextStyle(
                      color: paymentBlue,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(width: 5),
                  Icon(Icons.arrow_forward_ios, size: 13, color: paymentBlue),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator(color: paymentBlue));
    }

    if (errorMessage != null) {
      return _messageState(
        Icons.wifi_off_rounded,
        errorMessage!,
        action: TextButton(
          onPressed: loadBills,
          child: const Text('Try again'),
        ),
      );
    }

    final payments = allPayments;

    if (payments.isEmpty) {
      return _messageState(
        Icons.history_rounded,
        'You have not submitted any rental payments yet.',
      );
    }

    return RefreshIndicator(
      color: paymentBlue,
      onRefresh: loadBills,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: payments.length,
        itemBuilder: (context, index) {
          final payment = payments[index];
          final status = payment['status']?.toString() ?? 'unknown';

          final Color color;
          switch (status) {
            case 'approved':
              color = Colors.green;
              break;
            case 'rejected':
              color = Colors.red;
              break;
            case 'pending':
              color = Colors.orange;
              break;
            default:
              color = Colors.grey;
          }

          return Card(
            color: Colors.white,
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: paymentBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Payment #${payment['id'] ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      _statusBadge(status.toUpperCase(), color),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _infoRow(
                    'Submitted amount',
                    money(payment['submitted_amount'] ?? payment['amount']),
                  ),
                  _infoRow(
                    'Payment date',
                    dateText(
                      payment['submitted_payment_date'] ??
                          payment['payment_date'],
                    ),
                  ),
                  if ((payment['notes'] ?? '').toString().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 7),
                      child: Text(
                        'Notes: ${payment['notes']}',
                        style: const TextStyle(
                          color: Colors.black54,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  if (status == 'rejected' &&
                      (payment['rejection_reason'] ?? '').toString().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Reason: ${payment['rejection_reason']}',
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  if (status == 'pending')
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Waiting for the boarding-house owner to review your payment.',
                        style: TextStyle(color: Colors.orange, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _statusBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: paymentText,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _messageState(IconData icon, String message, {Widget? action}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 52, color: Colors.grey),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (action != null) action,
          ],
        ),
      ),
    );
  }
}

// ============================================================
// RENTAL BILL DETAILS
// ============================================================

class RentalBillDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> bill;
  final String Function(dynamic) money;
  final String Function(dynamic) dateText;

  const RentalBillDetailsScreen({
    super.key,
    required this.bill,
    required this.money,
    required this.dateText,
  });

  @override
  State<RentalBillDetailsScreen> createState() =>
      _RentalBillDetailsScreenState();
}

class _RentalBillDetailsScreenState extends State<RentalBillDetailsScreen> {
  bool loadingMethods = true;
  String? methodsError;
  List<Map<String, dynamic>> methods = [];

  @override
  void initState() {
    super.initState();
    loadPaymentMethods();
  }

  Future<void> loadPaymentMethods() async {
    final result = await ApiService.getStudentRentalPaymentMethods(
      billId: int.parse(widget.bill['id'].toString()),
    );

    if (!mounted) return;

    if (result['success'] == true) {
      final raw = result['data'];

      setState(() {
        methods = raw is List
            ? raw
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        loadingMethods = false;
      });
    } else {
      setState(() {
        methodsError =
            result['message']?.toString() ?? 'Unable to load payment methods.';
        loadingMethods = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bill = widget.bill;
    final isVoided = bill['is_voided'] == true;

    final outstanding =
        double.tryParse(
          (bill['total_outstanding'] ?? bill['balance'] ?? '0').toString(),
        ) ??
        0;

    final payments = bill['payments'] is List
        ? (bill['payments'] as List).whereType<Map>().toList()
        : <Map>[];

    final hasPending = payments.any(
      (payment) => payment['status']?.toString() == 'pending',
    );

    return Scaffold(
      backgroundColor: paymentBackground,
      appBar: AppBar(
        title: const Text('Bill Details'),
        backgroundColor: Colors.white,
        foregroundColor: paymentText,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Outstanding balance',
                    style: TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.money(bill['total_outstanding'] ?? bill['balance']),
                    style: const TextStyle(
                      fontSize: 29,
                      color: paymentBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Divider(height: 25),
                  _detailRow('Bill amount', widget.money(bill['amount'])),
                  _detailRow('Amount paid', widget.money(bill['amount_paid'])),
                  _detailRow('Due date', widget.dateText(bill['due_date'])),
                  _detailRow(
                    'Billing period',
                    '${widget.dateText(bill['rental_period_start'])} - '
                        '${widget.dateText(bill['rental_period_end'])}',
                  ),
                  _detailRow(
                    'Bill status',
                    bill['payment_status']?.toString() ?? 'Unknown',
                  ),
                  if (bill['overdue_days'] != null)
                    _detailRow('Overdue days', bill['overdue_days'].toString()),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Payment methods',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          if (loadingMethods)
            const Center(child: CircularProgressIndicator())
          else if (methodsError != null)
            Text(methodsError!)
          else if (methods.isEmpty)
            const Text(
              'The owner has not added any active payment methods yet.',
              style: TextStyle(color: Colors.black54),
            )
          else
            ...methods.map(_paymentMethodCard),
          const SizedBox(height: 20),
          if (hasPending)
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'You already have a payment awaiting review for this bill. '
                'Check Payment History for its status.',
                style: TextStyle(color: Colors.orange),
              ),
            )
          else if (!isVoided && outstanding > 0)
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SubmitRentalPaymentScreen(
                        bill: bill,
                        outstanding: outstanding,
                        money: widget.money,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.upload_file_rounded),
                label: const Text('Submit payment'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: paymentBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                  ),
                ),
              ),
            ),
          if (isVoided)
            const Text(
              'This bill has been voided. Payments cannot be submitted.',
              style: TextStyle(color: Colors.red),
            ),
          const SizedBox(height: 22),
          const Text(
            'Payments for this bill',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          if (payments.isEmpty)
            const Text(
              'No payment submissions yet.',
              style: TextStyle(color: Colors.black54),
            )
          else
            ...payments.map((payment) {
              final paymentStatus = payment['status']?.toString() ?? 'unknown';

              final Color color;
              switch (paymentStatus) {
                case 'approved':
                  color = Colors.green;
                  break;
                case 'rejected':
                  color = Colors.red;
                  break;
                case 'pending':
                  color = Colors.orange;
                  break;
                default:
                  color = Colors.grey;
              }

              return Card(
                color: Colors.white,
                elevation: 0,
                child: ListTile(
                  title: Text(
                    widget.money(
                      payment['submitted_amount'] ?? payment['amount'],
                    ),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Date: ${widget.dateText(payment['submitted_payment_date'] ?? payment['payment_date'])}'
                    '${(payment['rejection_reason'] ?? '').toString().isNotEmpty ? '\nReason: ${payment['rejection_reason']}' : ''}',
                  ),
                  trailing: Text(
                    paymentStatus.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _paymentMethodCard(Map<String, dynamic> method) {
    final hasQr = [
      method['qr_image_path'],
      method['qr_image_url'],
      method['qr_code_url'],
    ].any((value) => value != null && value.toString().isNotEmpty);

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              method['provider']?.toString() ?? 'Payment provider',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            _detailRow(
              'Account name',
              method['account_name']?.toString() ?? 'Not provided',
            ),
            _detailRow(
              'Account number',
              method['account_number']?.toString() ?? 'Not provided',
            ),
            if (hasQr)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _showQr(method),
                  icon: const Icon(Icons.qr_code_2_rounded),
                  label: const Text('View QR code'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showQr(Map<String, dynamic> method) async {
    final paymentMethodId = int.tryParse(method['id'].toString());

    if (paymentMethodId == null) {
      _showMessage('Invalid payment method.');
      return;
    }

    final bytes = await ApiService.getStudentRentalPaymentQr(
      billId: int.parse(widget.bill['id'].toString()),
      paymentMethodId: paymentMethodId,
    );

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Payment QR Code'),
        content: bytes == null
            ? const Text('Unable to load the QR code.')
            : Image.memory(
                bytes,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Text('Unable to display this QR code.');
                },
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// SUBMIT RENTAL PAYMENT
// ============================================================

class SubmitRentalPaymentScreen extends StatefulWidget {
  final Map<String, dynamic> bill;
  final double outstanding;
  final String Function(dynamic) money;

  const SubmitRentalPaymentScreen({
    super.key,
    required this.bill,
    required this.outstanding,
    required this.money,
  });

  @override
  State<SubmitRentalPaymentScreen> createState() =>
      _SubmitRentalPaymentScreenState();
}

class _SubmitRentalPaymentScreenState extends State<SubmitRentalPaymentScreen> {
  final amountController = TextEditingController();
  final referenceController = TextEditingController();
  final notesController = TextEditingController();

  DateTime paymentDate = DateTime.now();
  Uint8List? proofBytes;
  String? proofFileName;
  bool submitting = false;

  @override
  void dispose() {
    amountController.dispose();
    referenceController.dispose();
    notesController.dispose();
    super.dispose();
  }

  Future<void> pickProof() async {
    try {
      final files = await file_picker.FilePicker.pickFiles(
        type: file_picker.FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      );

      // An empty list means the user cancelled.
      if (files.isEmpty) return;

      final file = files.first;

      // Read the selected file.
      final bytes = await file.readAsBytes();

      if (bytes.isEmpty) {
        _showMessage('The selected file is empty.');
        return;
      }

      if (bytes.length > 5 * 1024 * 1024) {
        _showMessage('The selected file must not exceed 5 MB.');
        return;
      }

      if (!mounted) return;

      setState(() {
        proofBytes = bytes;
        proofFileName = file.name;
      });
    } catch (e) {
      _showMessage('Unable to select the proof file: $e');
    }
  }

  Future<void> choosePaymentDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: paymentDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );

    if (picked != null && mounted) {
      setState(() {
        paymentDate = picked;
      });
    }
  }

  String get formattedPaymentDate {
    return '${paymentDate.year}-'
        '${paymentDate.month.toString().padLeft(2, '0')}-'
        '${paymentDate.day.toString().padLeft(2, '0')}';
  }

  Future<void> submit() async {
    final amount = double.tryParse(amountController.text.trim());

    if (amount == null || amount <= 0) {
      _showMessage('Enter a valid payment amount.');
      return;
    }

    if (amount > widget.outstanding) {
      _showMessage('The amount cannot exceed the outstanding balance.');
      return;
    }

    if (proofBytes == null || proofFileName == null) {
      _showMessage('Please attach your proof of payment.');
      return;
    }

    setState(() {
      submitting = true;
    });

    final result = await ApiService.submitStudentRentalPayment(
      billId: int.parse(widget.bill['id'].toString()),
      amount: amount.toStringAsFixed(2),
      paymentDate: formattedPaymentDate,
      referenceNumber: referenceController.text.trim(),
      notes: notesController.text.trim(),
      proofBytes: proofBytes!,
      proofFileName: proofFileName!,
    );

    if (!mounted) return;

    setState(() {
      submitting = false;
    });

    if (result['success'] == true) {
      await showDialog(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Payment submitted'),
          content: const Text(
            'Your payment proof has been submitted successfully. '
            'The owner must review it before it is approved.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Continue'),
            ),
          ],
        ),
      );

      if (!mounted) return;
      Navigator.pop(context, true);
    } else {
      _showMessage(
        result['message']?.toString() ?? 'Payment submission failed.',
      );
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final isPdf = proofFileName?.toLowerCase().endsWith('.pdf') ?? false;

    return Scaffold(
      backgroundColor: paymentBackground,
      appBar: AppBar(
        title: const Text('Submit Payment'),
        backgroundColor: Colors.white,
        foregroundColor: paymentText,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(15),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Outstanding balance',
                  style: TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 5),
                Text(
                  widget.money(widget.outstanding),
                  style: const TextStyle(
                    fontSize: 25,
                    color: paymentBlue,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _fieldLabel('Amount paid'),
          TextField(
            controller: amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: _inputDecoration(
              'Enter amount',
              prefix: const Text('₱ '),
            ),
          ),
          const SizedBox(height: 16),
          _fieldLabel('Payment date'),
          InkWell(
            onTap: choosePaymentDate,
            child: InputDecorator(
              decoration: _inputDecoration(''),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today, color: paymentBlue),
                  const SizedBox(width: 10),
                  Text(formattedPaymentDate),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _fieldLabel('Transaction reference number'),
          TextField(
            controller: referenceController,
            decoration: _inputDecoration('Enter GCash / bank reference'),
          ),
          const SizedBox(height: 5),
          const Text(
            'The reference number will be included in your payment notes.',
            style: TextStyle(color: Colors.black54, fontSize: 11),
          ),
          const SizedBox(height: 16),
          _fieldLabel('Notes (optional)'),
          TextField(
            controller: notesController,
            maxLines: 3,
            maxLength: 1000,
            decoration: _inputDecoration('Additional payment information'),
          ),
          const SizedBox(height: 10),
          _fieldLabel('Proof of payment'),
          OutlinedButton.icon(
            onPressed: submitting ? null : pickProof,
            icon: const Icon(Icons.attach_file_rounded),
            label: Text(proofFileName ?? 'Choose image or PDF (maximum 5 MB)'),
            style: OutlinedButton.styleFrom(
              foregroundColor: paymentBlue,
              padding: const EdgeInsets.all(15),
              alignment: Alignment.centerLeft,
            ),
          ),
          if (proofBytes != null && !isPdf) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.memory(
                proofBytes!,
                height: 180,
                width: double.infinity,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Text('The selected file cannot be previewed.');
                },
              ),
            ),
          ],
          if (proofBytes != null && isPdf)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  Icon(Icons.picture_as_pdf, color: Colors.red),
                  SizedBox(width: 8),
                  Text('PDF proof selected'),
                ],
              ),
            ),
          const SizedBox(height: 25),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: submitting ? null : submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: paymentBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: submitting
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Submit payment for review',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Your payment will remain pending until the boarding-house owner reviews it.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w600, color: paymentText),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, {Widget? prefix}) {
    return InputDecoration(
      hintText: hint,
      prefix: prefix,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: paymentBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: paymentBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: paymentBlue),
      ),
    );
  }
}
