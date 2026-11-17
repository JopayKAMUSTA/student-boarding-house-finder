import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'boarding_house_details_screen.dart';

const Color exploreBlue = Color(0xFF2563EB);
const Color exploreBackground = Color(0xFFF7F8FC);

class ExploreScreen extends StatefulWidget {
  final List<Map<String, dynamic>> boardingHouses;

  const ExploreScreen({super.key, required this.boardingHouses});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  String searchQuery = '';
  String selectedCity = 'All locations';
  String selectedSort = 'Recommended';

  String _getText(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    return value.toString();
  }

  double _getNumber(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _getPrice(Map<String, dynamic> house) {
    return _getNumber(house['price'] ?? house['monthly_rent']);
  }

  double _getRooms(Map<String, dynamic> house) {
    return _getNumber(house['rooms'] ?? house['available_rooms']);
  }

  List<String> _getAmenities(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }
    return [];
  }

  // GET BOARDING HOUSE IMAGE

  // GET BOARDING HOUSE COVER IMAGE
  String? _getHouseImage(Map<String, dynamic> house) {
    // First, use the API-provided cover image.
    final cover = ApiService.resolveImageUrl(house['cover_image_url']);

    if (cover != null) return cover;

    // Next, check the boarding-house image fields.
    final image = ApiService.resolveImageUrl(
      house['image_url'] ?? house['thumbnail'],
    );

    if (image != null) return image;

    // Check the boarding-house-level image list.
    final dynamic rawImages = house['images'];

    if (rawImages is List && rawImages.isNotEmpty) {
      for (final item in rawImages) {
        final dynamic value = item is Map
            ? item['url'] ??
                  item['image_url'] ??
                  item['image_path'] ??
                  item['path'] ??
                  item['file_path']
            : item;

        final url = ApiService.resolveImageUrl(value);

        if (url != null) return url;
      }
    }

    // Finally, check images belonging to individual rooms.
    final dynamic rawRooms = house['rooms'];

    if (rawRooms is List) {
      for (final room in rawRooms) {
        if (room is! Map) continue;

        final dynamic roomImages = room['images'];

        if (roomImages is List && roomImages.isNotEmpty) {
          for (final item in roomImages) {
            final dynamic value = item is Map
                ? item['url'] ??
                      item['image_url'] ??
                      item['image_path'] ??
                      item['path'] ??
                      item['file_path']
                : item;

            final url = ApiService.resolveImageUrl(value);

            if (url != null) return url;
          }
        }

        final roomImage = ApiService.resolveImageUrl(room['image_url']);

        if (roomImage != null) return roomImage;
      }
    }

    return null;
  }

  List<Map<String, dynamic>> get filteredHouses {
    final query = searchQuery.trim().toLowerCase();

    final results = widget.boardingHouses.where((house) {
      final city = _getText(house['city']);

      final matchesCity =
          selectedCity == 'All locations' ||
          city.toLowerCase() == selectedCity.toLowerCase();

      final amenities = _getAmenities(house['amenities']);

      final searchableValues = [
        house['name'],
        house['city'],
        house['location'],
        house['address'],
        house['description'],
        ...amenities,
      ];

      final matchesSearch =
          query.isEmpty ||
          searchableValues.any(
            (value) => _getText(value).toLowerCase().contains(query),
          );

      return matchesCity && matchesSearch;
    }).toList();

    if (selectedSort == 'Lowest rent') {
      results.sort((a, b) => _getPrice(a).compareTo(_getPrice(b)));
    } else if (selectedSort == 'Highest rent') {
      results.sort((a, b) => _getPrice(b).compareTo(_getPrice(a)));
    } else if (selectedSort == 'Most rooms') {
      results.sort((a, b) => _getRooms(b).compareTo(_getRooms(a)));
    }

    return results;
  }

  @override
  Widget build(BuildContext context) {
    final houses = filteredHouses;

    return Scaffold(
      backgroundColor: exploreBackground,
      appBar: AppBar(
        backgroundColor: exploreBackground,
        elevation: 0,
        title: const Text(
          'Explore Boarding Houses',
          style: TextStyle(
            color: Color(0xFF172033),
            fontWeight: FontWeight.bold,
            fontSize: 19,
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Column(
              children: [
                TextField(
                  onChanged: (value) {
                    setState(() {
                      searchQuery = value;
                    });
                  },
                  decoration: InputDecoration(
                    hintText: 'Search name, city, or amenity',
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      color: exploreBlue,
                    ),
                    suffixIcon: searchQuery.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              setState(() {
                                searchQuery = '';
                              });
                            },
                            icon: const Icon(Icons.close_rounded),
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(15),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // CITY FILTERS
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['All locations', 'Tagum City', 'Davao City'].map(
                      (city) {
                        final selected = selectedCity == city;

                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(city),
                            selected: selected,
                            showCheckmark: false,
                            selectedColor: exploreBlue,
                            backgroundColor: Colors.white,
                            labelStyle: TextStyle(
                              color: selected ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.w600,
                            ),
                            onSelected: (_) {
                              setState(() {
                                selectedCity = city;
                              });
                            },
                          ),
                        );
                      },
                    ).toList(),
                  ),
                ),
                const SizedBox(height: 10),

                // RESULTS COUNT AND SORT
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${houses.length} boarding house${houses.length == 1 ? '' : 's'} found',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.black54,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<String>(
                      value: selectedSort,
                      underline: const SizedBox.shrink(),
                      items: const [
                        DropdownMenuItem(
                          value: 'Recommended',
                          child: Text('Recommended'),
                        ),
                        DropdownMenuItem(
                          value: 'Lowest rent',
                          child: Text('Lowest rent'),
                        ),
                        DropdownMenuItem(
                          value: 'Highest rent',
                          child: Text('Highest rent'),
                        ),
                        DropdownMenuItem(
                          value: 'Most rooms',
                          child: Text('Most rooms'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() {
                            selectedSort = value;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),

          // BOARDING HOUSE LIST
          Expanded(
            child: houses.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.search_off_rounded,
                            size: 54,
                            color: Colors.grey,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No boarding houses found',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Try another search or city.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: houses.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      return _buildHouseCard(context, houses[index]);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  // BOARDING HOUSE CARD
  Widget _buildHouseCard(BuildContext context, Map<String, dynamic> house) {
    final String name = _getText(
      house['name'],
      fallback: 'Unnamed Boarding House',
    );

    final String city = _getText(house['city']);
    final String location = _getText(house['location'] ?? house['address']);

    final double price = _getPrice(house);
    final double rooms = _getRooms(house);

    final List<String> amenities = _getAmenities(house['amenities']);

    final imageUrl = _getHouseImage(house);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => BoardingHouseDetailsScreen(house: house),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // BOARDING HOUSE IMAGE
              ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: Container(
                  width: 90,
                  height: 105,
                  color: const Color(0xFFE5ECFA),
                  child: imageUrl != null
                      ? Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) {
                            return const Icon(
                              Icons.home_rounded,
                              color: exploreBlue,
                              size: 38,
                            );
                          },
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) {
                              return child;
                            }

                            return const Center(
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: exploreBlue,
                              ),
                            );
                          },
                        )
                      : const Icon(
                          Icons.home_rounded,
                          color: exploreBlue,
                          size: 38,
                        ),
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
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Color(0xFF172033),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '$city · $location',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      '${rooms.toStringAsFixed(0)} rooms available',
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '₱${price.toStringAsFixed(0)} / month',
                      style: const TextStyle(
                        color: exploreBlue,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    if (amenities.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: amenities.map((amenity) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5FF),
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: Text(
                              amenity,
                              style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFF355DAA),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: exploreBlue),
            ],
          ),
        ),
      ),
    );
  }
}
