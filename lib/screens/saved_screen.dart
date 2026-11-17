
import 'package:flutter/material.dart';
import 'boarding_house_details_screen.dart';

const Color savedBlue = Color(0xFF2563EB);
const Color savedBackground = Color(0xFFF7F8FC);

class SavedScreen extends StatelessWidget {
  final List<Map<String, dynamic>> boardingHouses;
  final Set<String> favorites;
  final VoidCallback onFavoritesChanged;

  const SavedScreen({
    super.key,
    required this.boardingHouses,
    required this.favorites,
    required this.onFavoritesChanged,
  });

  // GET FAVORITE ID
  String _getFavoriteKey(Map<String, dynamic> house) {
    return (house['id'] ?? house['name'] ?? '').toString();
  }

  // GET TEXT SAFELY
  String _getText(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }

  // GET PRICE SAFELY
  String _getPrice(Map<String, dynamic> house) {
    final price = house['price'] ?? house['monthly_rent'] ?? 0;

    if (price is num) {
      return price.toStringAsFixed(0);
    }

    return price.toString();
  }

  // GET SAVED BOARDING HOUSES
  List<Map<String, dynamic>> _getSavedHouses() {
    return boardingHouses.where((house) {
      return favorites.contains(_getFavoriteKey(house));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final savedHouses = _getSavedHouses();

    return Scaffold(
      backgroundColor: savedBackground,
      appBar: AppBar(
        backgroundColor: savedBackground,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Saved Boarding Houses',
          style: TextStyle(
            color: Color(0xFF172033),
            fontSize: 19,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: savedHouses.isEmpty
          ? _buildEmptyState()
          : ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: savedHouses.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final house = savedHouses[index];

                return _buildSavedCard(context, house);
              },
            ),
    );
  }

  // EMPTY STATE
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: const BoxDecoration(
                color: Color(0xFFE4ECFF),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.favorite_border_rounded,
                size: 44,
                color: savedBlue,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No saved boarding houses yet',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
                color: Color(0xFF172033),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Tap the heart on a boarding house to save it here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.black54,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // SAVED BOARDING HOUSE CARD
  Widget _buildSavedCard(
    BuildContext context,
    Map<String, dynamic> house,
  ) {
    final String name = _getText(
      house['name'],
      fallback: 'Unnamed Boarding House',
    );

    final String city = _getText(house['city']);

    final String location = _getText(
      house['location'] ?? house['address'],
    );

    final String price = _getPrice(house);

    final IconData houseIcon = house['icon'] is IconData
        ? house['icon'] as IconData
        : Icons.home_rounded;

    return Card(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(
          color: Color(0xFFEEF0F5),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => BoardingHouseDetailsScreen(
                house: house,
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              // HOUSE IMAGE PLACEHOLDER
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5ECFA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  houseIcon,
                  size: 32,
                  color: savedBlue,
                ),
              ),

              const SizedBox(width: 13),

              // HOUSE INFORMATION
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF172033),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '$city · $location',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      '₱$price / month',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: savedBlue,
                      ),
                    ),
                  ],
                ),
              ),

              // REMOVE FAVORITE
              IconButton(
                tooltip: 'Remove from saved',
                onPressed: () {
                  favorites.remove(_getFavoriteKey(house));
                  onFavoritesChanged();

                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Removed from saved boarding houses.',
                      ),
                    ),
                  );
                },
                icon: const Icon(
                  Icons.favorite_rounded,
                  color: Colors.red,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
