
import 'package:flutter/material.dart';
import 'boarding_house_details_screen.dart';

const Color exploreBlue = Color(0xFF2563EB);
const Color exploreBackground = Color(0xFFF7F8FC);

class ExploreScreen extends StatefulWidget {
  final List<Map<String, dynamic>> boardingHouses;

  const ExploreScreen({
    super.key,
    required this.boardingHouses,
  });

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  String searchQuery = '';
  String selectedCity = 'All locations';
  String selectedSort = 'Recommended';

  List<Map<String, dynamic>> get filteredHouses {
    final query = searchQuery.trim().toLowerCase();

    final results = widget.boardingHouses.where((house) {
      final matchesCity = selectedCity == 'All locations' ||
          house['city'] == selectedCity;

      final amenities = List<String>.from(
        house['amenities'] ?? [],
      );

      final matchesSearch = query.isEmpty ||
          (house['name'] as String).toLowerCase().contains(query) ||
          (house['city'] as String).toLowerCase().contains(query) ||
          (house['location'] as String).toLowerCase().contains(query) ||
          amenities.any(
            (amenity) => amenity.toLowerCase().contains(query),
          );

      return matchesCity && matchesSearch;
    }).toList();

    if (selectedSort == 'Lowest rent') {
      results.sort(
        (a, b) => (a['price'] as num).compareTo(b['price'] as num),
      );
    } else if (selectedSort == 'Highest rent') {
      results.sort(
        (a, b) => (b['price'] as num).compareTo(a['price'] as num),
      );
    } else if (selectedSort == 'Most rooms') {
      results.sort(
        (a, b) => (b['rooms'] as num).compareTo(a['rooms'] as num),
      );
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
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      'All locations',
                      'Tagum City',
                      'Davao City',
                    ].map((city) {
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
                            color: selected
                                ? Colors.white
                                : Colors.black87,
                            fontWeight: FontWeight.w600,
                          ),
                          onSelected: (_) {
                            setState(() {
                              selectedCity = city;
                            });
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 10),
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
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final house = houses[index];

                      return _buildHouseCard(context, house);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHouseCard(
    BuildContext context,
    Map<String, dynamic> house,
  ) {
    final amenities = List<String>.from(
      house['amenities'] ?? [],
    );

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 78,
                height: 90,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5ECFA),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  house['icon'] as IconData,
                  color: exploreBlue,
                  size: 38,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      house['name'] as String,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Color(0xFF172033),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${house['city']} · ${house['location']}',
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      '${house['rooms']} rooms available',
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '₱${house['price']} / month',
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
              const Icon(
                Icons.chevron_right_rounded,
                color: exploreBlue,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
