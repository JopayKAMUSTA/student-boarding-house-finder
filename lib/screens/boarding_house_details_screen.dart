import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'student_chat_screen.dart';

class BoardingHouseDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> house;

  const BoardingHouseDetailsScreen({super.key, required this.house});

  @override
  State<BoardingHouseDetailsScreen> createState() =>
      _BoardingHouseDetailsScreenState();
}

class _BoardingHouseDetailsScreenState
    extends State<BoardingHouseDetailsScreen> {
  static const Color primaryBlue = Color(0xFF2563EB);

  bool _isContactingOwner = false;

  String _text(dynamic value, [String fallback = 'Not provided']) {
    if (value == null || value.toString().trim().isEmpty) {
      return fallback;
    }
    return value.toString();
  }

  String? _resolveImageUrl(dynamic value) {
    return ApiService.resolveImageUrl(value);
  }

  List<String> _getImages() {
    final List<String> images = [];

    void addImage(dynamic value) {
      final url = _resolveImageUrl(value);

      if (url != null && !images.contains(url)) {
        images.add(url);
      }
    }

    final dynamic rawImages = widget.house['images'];

    if (rawImages is List) {
      for (final image in rawImages) {
        if (image is Map) {
          addImage(
            image['url'] ??
                image['image_url'] ??
                image['image_path'] ??
                image['path'] ??
                image['file_path'],
          );
        } else {
          addImage(image);
        }
      }
    }

    final dynamic rawRooms = widget.house['rooms'];

    if (rawRooms is List) {
      for (final room in rawRooms) {
        if (room is! Map) continue;

        final dynamic roomImages = room['images'];

        if (roomImages is List) {
          for (final image in roomImages) {
            if (image is Map) {
              addImage(
                image['url'] ??
                    image['image_url'] ??
                    image['image_path'] ??
                    image['path'] ??
                    image['file_path'],
              );
            } else {
              addImage(image);
            }
          }
        }

        addImage(room['image_url']);
      }
    }

    final cover = _resolveImageUrl(widget.house['cover_image_url']);

    if (cover != null) {
      images.remove(cover);
      images.insert(0, cover);
    }

    addImage(widget.house['image_url']);

    return images;
  }

  Future<void> _contactOwner() async {
    if (_isContactingOwner) return;

    final houseId = int.tryParse(widget.house['id']?.toString() ?? '');

    if (houseId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Boarding house ID is missing.')),
      );
      return;
    }

    setState(() {
      _isContactingOwner = true;
    });

    try {
      final response = await ApiService.createStudentConversation(
        boardingHouseId: houseId,
      );

      if (!mounted) return;

      if (response['success'] != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              response['message']?.toString() ?? 'Unable to contact the owner.',
            ),
          ),
        );
        return;
      }

      final dynamic data = response['data'];

      final conversationId = data is Map
          ? int.tryParse(data['id']?.toString() ?? '')
          : null;

      if (conversationId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid conversation response from server.'),
          ),
        );
        return;
      }

      final houseName = _text(
        widget.house['name'] ?? widget.house['boarding_house_name'],
        'Boarding House',
      );

      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => StudentChatScreen(
            conversationId: conversationId,
            boardingHouseName: houseName,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Unable to contact owner: $e')));
    } finally {
      if (mounted) {
        setState(() {
          _isContactingOwner = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final images = _getImages();

    final name = _text(
      widget.house['name'] ?? widget.house['boarding_house_name'],
      'Boarding House',
    );

    final city = _text(widget.house['city']);
    final barangay = _text(widget.house['barangay']);
    final address = _text(widget.house['address']);

    final rent = widget.house['monthly_rent'] ?? widget.house['rent'];

    final rooms =
        widget.house['available_rooms'] ?? widget.house['available_room'];

    final amenities = widget.house['amenities'];

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FC),
      appBar: AppBar(
        title: const Text('Boarding House Details'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 260,
              width: double.infinity,
              child: images.isEmpty
                  ? Container(
                      color: Colors.grey.shade200,
                      child: const Icon(
                        Icons.home_outlined,
                        size: 75,
                        color: Colors.grey,
                      ),
                    )
                  : PageView.builder(
                      itemCount: images.length,
                      itemBuilder: (context, index) {
                        return Image.network(
                          images[index],
                          fit: BoxFit.cover,
                          width: double.infinity,
                          errorBuilder: (_, __, ___) {
                            return Container(
                              color: Colors.grey.shade200,
                              child: const Icon(
                                Icons.broken_image_outlined,
                                size: 60,
                                color: Colors.grey,
                              ),
                            );
                          },
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;

                            return const Center(
                              child: CircularProgressIndicator(),
                            );
                          },
                        );
                      },
                    ),
            ),

            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),

                  const SizedBox(height: 10),

                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        color: primaryBlue,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '$barangay, $city',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  _infoCard(
                    icon: Icons.payments_outlined,
                    title: 'Monthly Rent',
                    value: rent == null ? 'Not provided' : '₱$rent',
                  ),

                  const SizedBox(height: 12),

                  _infoCard(
                    icon: Icons.meeting_room_outlined,
                    title: 'Available Rooms',
                    value: _text(rooms),
                  ),

                  const SizedBox(height: 12),

                  _infoCard(
                    icon: Icons.location_city_outlined,
                    title: 'Full Address',
                    value: address,
                  ),

                  const SizedBox(height: 22),

                  const Text(
                    'Description',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
                  ),

                  const SizedBox(height: 8),

                  Text(
                    _text(widget.house['description']),
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade700,
                      height: 1.5,
                    ),
                  ),

                  const SizedBox(height: 22),

                  const Text(
                    'Amenities',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
                  ),

                  const SizedBox(height: 10),

                  if (amenities is List && amenities.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: amenities.map<Widget>((item) {
                        final label = item is Map
                            ? _text(item['name'] ?? item['amenity_name'])
                            : item.toString();

                        return Chip(
                          avatar: const Icon(
                            Icons.check_circle_outline,
                            size: 18,
                            color: primaryBlue,
                          ),
                          label: Text(label),
                          backgroundColor: Colors.white,
                        );
                      }).toList(),
                    )
                  else
                    Text(
                      'No amenities listed.',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),

                  const SizedBox(height: 28),

                  // CONTACT OWNER BUTTON
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _isContactingOwner ? null : _contactOwner,
                      icon: _isContactingOwner
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.chat_bubble_outline),
                      label: Text(
                        _isContactingOwner ? 'Connecting...' : 'Contact Owner',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryBlue,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: primaryBlue.withValues(
                          alpha: 0.6,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoCard({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: primaryBlue, size: 25),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
