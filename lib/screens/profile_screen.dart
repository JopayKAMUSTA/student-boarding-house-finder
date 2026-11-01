
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

const Color profileBlue = Color(0xFF2563EB);
const Color profileBackground = Color(0xFFF7F8FC);

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  String studentName = 'Student Name';
  String studentEmail = 'student@example.com';
  String studentRole = 'Student';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _performLogout() async {
  final result = await ApiService.logout();

  if (!mounted) return;

  if (result['success'] == true) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (context) => const LoginScreen(),
      ),
      (route) => false,
    );
  } else {
    _showMessage(
      context,
      result['message'] ?? 'Unable to log out.',
    );
  }
}

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService.getProfile();

    if (!mounted) return;

    if (result['success'] == true) {
      // Supports either a direct user object or a nested data object.
      final dynamic profileData = result['data'];

      final Map<String, dynamic> user =
          profileData is Map<String, dynamic>
              ? profileData
              : result;

      setState(() {
        studentName = user['name'] ??
            '${user['first_name'] ?? ''} '
                '${user['last_name'] ?? ''}'.trim();

        studentEmail = user['email'] ?? 'No email available';
        studentRole = user['role'] ?? 'Student';
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage =
            result['message'] ?? 'Unable to load your profile.';
        _isLoading = false;
      });
    }
  }

  void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: profileBackground,
      appBar: AppBar(
        title: const Text(
          'My Profile',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loadProfile,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh profile',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: profileBlue),
            )
          : RefreshIndicator(
              onRefresh: _loadProfile,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          Text(
                            _errorMessage!,
                            style: const TextStyle(color: Colors.red),
                            textAlign: TextAlign.center,
                          ),
                          TextButton(
                            onPressed: _loadProfile,
                            child: const Text('Try Again'),
                          ),
                        ],
                      ),
                    ),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        const CircleAvatar(
                          radius: 42,
                          backgroundColor: Color(0xFFE8EEFF),
                          child: Icon(
                            Icons.person_rounded,
                            size: 48,
                            color: profileBlue,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          studentName,
                          style: const TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          studentEmail,
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8EEFF),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '$studentRole Account',
                            style: const TextStyle(
                              color: profileBlue,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'Account',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildMenuItem(
                    context,
                    icon: Icons.person_outline_rounded,
                    title: 'Personal Information',
                    subtitle: 'View and update your details',
                    onTap: () => _showMessage(
                      context,
                      'Personal information will be available soon.',
                    ),
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.favorite_border_rounded,
                    title: 'Saved Boarding Houses',
                    subtitle: 'View your favorite places',
                    onTap: () => _showMessage(
                      context,
                      'Open Saved from the bottom navigation.',
                    ),
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.history_rounded,
                    title: 'My Bookings',
                    subtitle: 'View your booking requests',
                    onTap: () => _showMessage(
                      context,
                      'Bookings will be available soon.',
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Support and Settings',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildMenuItem(
                    context,
                    icon: Icons.help_outline_rounded,
                    title: 'Help and Support',
                    subtitle: 'Get assistance using TagStay',
                    onTap: () => _showMessage(
                      context,
                      'Help and support will be available soon.',
                    ),
                  ),
                  _buildMenuItem(
                    context,
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy',
                    subtitle: 'Learn how your information is handled',
                    onTap: () => _showMessage(
                      context,
                      'Privacy information will be available soon.',
                    ),
                  ),
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                    onPressed: () => _showLogoutDialog(context),
                    icon: const Icon(Icons.logout_rounded, color: Colors.red),
                    label: const Text(
                      'Log Out',
                      style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      side: const BorderSide(color: Color(0xFFFFD5D5)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Center(
                    child: Text(
                      'TagStay • Find your place',
                      style: TextStyle(
                        color: Colors.grey,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 5,
        ),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFEFF3FF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: profileBlue),
        ),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(fontSize: 12),
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: Colors.grey,
        ),
        onTap: onTap,
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
  showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Log Out'),
      content: const Text(
        'Are you sure you want to log out of your account?',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(dialogContext);
            await _performLogout();
          },
          child: const Text(
            'Log Out',
            style: TextStyle(color: Colors.red),
          ),
        ),
      ],
    ),
  );
}
}
