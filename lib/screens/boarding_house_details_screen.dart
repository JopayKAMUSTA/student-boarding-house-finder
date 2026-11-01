
import 'package:flutter/material.dart';

const Color primaryBlue = Color(0xFF2563EB);
const Color pageBackground = Color(0xFFF7F8FC);

class BoardingHouseDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> house;

  const BoardingHouseDetailsScreen({
    super.key,
    required this.house,
  });

  @override
  Widget build(BuildContext context) {
    final String name = house['name']?.toString() ?? 'Boarding House';
    final String city = house['city']?.toString() ?? '';
    final String location = house['location']?.toString() ?? '';
    final double rent =
        double.tryParse(house['price'].toString()) ?? 0;
    final int availableRooms =
        int.tryParse(house['rooms'].toString()) ?? 0;
    final List<String> amenities =
        List<String>.from(house['amenities'] ?? []);

    return Scaffold(
      backgroundColor: pageBackground,
      appBar: AppBar(
        backgroundColor: pageBackground,
        elevation: 0,
        title: const Text(
          'Boarding House Details',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Placeholder for the boarding house photo.
          Container(
            height: 220,
            decoration: BoxDecoration(
              color: const Color(0xFFE1EAFE),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Center(
              child: Icon(
                Icons.apartment_rounded,
                size: 90,
                color: primaryBlue,
              ),
            ),
          ),

          const SizedBox(height: 22),

          Text(
            name,
            style: const TextStyle(
              fontSize: 25,
              fontWeight: FontWeight.bold,
              color: Color(0xFF202633),
            ),
          ),

          const SizedBox(height: 10),

          Row(
            children: [
              const Icon(
                Icons.location_on_outlined,
                color: primaryBlue,
                size: 20,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '$location, $city',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Monthly Rent',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '₱${rent.toStringAsFixed(0)} / month',
                  style: const TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.bold,
                    color: primaryBlue,
                  ),
                ),
                const Divider(height: 28),
                Row(
                  children: [
                    const Icon(
                      Icons.meeting_room_outlined,
                      color: primaryBlue,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '$availableRooms rooms available',
                      style: const TextStyle(fontSize: 15),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          const Text(
            'Amenities',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 12),

          if (amenities.isEmpty)
            const Text(
              'No amenities listed yet.',
              style: TextStyle(color: Colors.black54),
            )
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: amenities.map((amenity) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8EEFF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    amenity,
                    style: const TextStyle(
                      color: primaryBlue,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }).toList(),
            ),

          const SizedBox(height: 24),

          const Text(
            'About this boarding house',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 10),

          Text(
            house['description']?.toString() ??
                'More information about this boarding house will be available soon.',
            style: const TextStyle(
              fontSize: 15,
              height: 1.6,
              color: Colors.black54,
            ),
          ),

          const SizedBox(height: 30),

          SizedBox(
            height: 54,
            child: ElevatedButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Owner messaging will be added in a later step.',
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.chat_bubble_outline),
              label: const Text(
                'Contact Owner',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
