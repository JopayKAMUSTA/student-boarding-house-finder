
import 'package:flutter/material.dart';

import 'boarding_house_details_screen.dart';
import 'compare_screen.dart';
import 'saved_screen.dart';
import 'explore_screen.dart';
import 'profile_screen.dart';
import '../services/api_service.dart';

const Color primaryBlue = Color(0xFF2563EB);
const Color pageBackground = Color(0xFFF7F8FC);

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String selectedCity = 'All locations';
  String searchQuery = '';

  bool isLoading = true;
  String? errorMessage;

  List<Map<String, dynamic>> boardingHouses = [];

  final Set<String> favorites = {};

  @override
  void initState() {
    super.initState();
    _loadBoardingHouses();
  }

  // LOAD BOARDING HOUSES FROM LARAVEL API
  Future<void> _loadBoardingHouses() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    final result = await ApiService.getBoardingHouses();

    if (!mounted) return;

    if (result['success'] == true) {
      setState(() {
        boardingHouses = List<Map<String, dynamic>>.from(
          result['data'] ?? [],
        );
        isLoading = false;
      });
    } else {
      setState(() {
        errorMessage =
            result['message'] ?? 'Failed to load boarding houses.';
        isLoading = false;
      });
    }
  }

  // OPEN PROFILE
  void _openProfileScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const ProfileScreen(),
      ),
    );
  }

  // OPEN EXPLORE
  void _openExploreScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ExploreScreen(
          boardingHouses: boardingHouses,
        ),
      ),
    );
  }

  // OPEN SAVED
  void _openSavedScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SavedScreen(
          boardingHouses: boardingHouses,
          favorites: favorites,
          onFavoritesChanged: () {
            setState(() {});
          },
        ),
      ),
    ).then((_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  // OPEN COMPARE
  void _openCompareScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CompareScreen(
          boardingHouses: boardingHouses,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = searchQuery.trim().toLowerCase();

    final visibleHouses = boardingHouses.where((house) {
      final matchesCity = selectedCity == 'All locations' ||
          (house['city'] ?? '').toString().toLowerCase() ==
              selectedCity.toLowerCase();

      final amenities = List<String>.from(
        house['amenities'] ?? [],
      );

      final matchesSearch = query.isEmpty ||
          (house['name'] ?? '')
              .toString()
              .toLowerCase()
              .contains(query) ||
          (house['city'] ?? '')
              .toString()
              .toLowerCase()
              .contains(query) ||
          (house['location'] ?? '')
              .toString()
              .toLowerCase()
              .contains(query) ||
          (house['address'] ?? '')
              .toString()
              .toLowerCase()
              .contains(query) ||
          (house['description'] ?? '')
              .toString()
              .toLowerCase()
              .contains(query) ||
          amenities.any(
            (amenity) => amenity.toLowerCase().contains(query),
          );

      return matchesCity && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: pageBackground,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _buildHeader(),
                  const SizedBox(height: 28),
                  _buildGreeting(),
                  const SizedBox(height: 22),
                  _buildSearchBar(),
                  const SizedBox(height: 18),
                  _buildCityFilters(),
                  const SizedBox(height: 28),
                  _buildRecommendationHeader(),
                  const SizedBox(height: 16),
                ]),
              ),
            ),

            // BOARDING HOUSE RESULTS
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverToBoxAdapter(
                child: _buildBoardingHouseResults(visibleHouses),
              ),
            ),

            const SliverToBoxAdapter(
              child: SizedBox(height: 20),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  // LOADING, ERROR, EMPTY AND SUCCESS STATES
  Widget _buildBoardingHouseResults(
    List<Map<String, dynamic>> visibleHouses,
  ) {
    if (isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 50),
        child: Center(
          child: CircularProgressIndicator(
            color: primaryBlue,
          ),
        ),
      );
    }

    if (errorMessage != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(
              Icons.wifi_off_rounded,
              size: 48,
              color: Colors.grey,
            ),
            const SizedBox(height: 12),
            Text(
              errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: _loadBoardingHouses,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryBlue,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    }

    if (visibleHouses.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(
              Icons.search_off_rounded,
              size: 48,
              color: Colors.grey,
            ),
            SizedBox(height: 12),
            Text(
              'No boarding houses found',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Try another name or location.',
              style: TextStyle(
                color: Colors.grey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      children: visibleHouses.map((house) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => BoardingHouseDetailsScreen(
                    house: house,
                  ),
                ),
              );
            },
            child: _buildHouseCard(house),
          ),
        );
      }).toList(),
    );
  }

  // HEADER
  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: primaryBlue,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(
            Icons.house_rounded,
            color: Colors.white,
            size: 27,
          ),
        ),
        const SizedBox(width: 10),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'TagStay',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF172033),
              ),
            ),
            Text(
              'Find your student home',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey,
              ),
            ),
          ],
        ),
        const Spacer(),
        CircleAvatar(
          radius: 22,
          backgroundColor: const Color(0xFFE4ECFF),
          child: IconButton(
            tooltip: 'Profile',
            onPressed: _openProfileScreen,
            icon: const Icon(
              Icons.person_outline_rounded,
              color: primaryBlue,
            ),
          ),
        ),
      ],
    );
  }

  // GREETING
  Widget _buildGreeting() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Find your place to',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: Color(0xFF172033),
            height: 1.2,
          ),
        ),
        Text(
          'call home.',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: primaryBlue,
            height: 1.2,
          ),
        ),
        SizedBox(height: 8),
        Text(
          'Discover boarding houses that fit your budget.',
          style: TextStyle(
            fontSize: 14,
            color: Colors.black54,
          ),
        ),
      ],
    );
  }

  // SEARCH
  Widget _buildSearchBar() {
    return TextField(
      onChanged: (value) {
        setState(() {
          searchQuery = value;
        });
      },
      decoration: InputDecoration(
        hintText: 'City, school, or boarding house',
        hintStyle: const TextStyle(fontSize: 13),
        prefixIcon: const Icon(
          Icons.search_rounded,
          color: primaryBlue,
        ),
        suffixIcon: searchQuery.isNotEmpty
            ? IconButton(
                tooltip: 'Clear search',
                icon: const Icon(Icons.close_rounded),
                onPressed: () {
                  setState(() {
                    searchQuery = '';
                  });
                },
              )
            : null,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(vertical: 17),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: Color(0xFFEEF0F5),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: primaryBlue,
          ),
        ),
      ),
    );
  }

  // CITY FILTERS
  Widget _buildCityFilters() {
    final cities = [
      'All locations',
      'Tagum City',
      'Davao City',
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: cities.map((city) {
          final selected = selectedCity == city;

          return Padding(
            padding: const EdgeInsets.only(right: 9),
            child: ChoiceChip(
              label: Text(city),
              selected: selected,
              showCheckmark: false,
              selectedColor: primaryBlue,
              backgroundColor: Colors.white,
              labelStyle: TextStyle(
                color: selected ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: BorderSide(
                  color: selected
                      ? primaryBlue
                      : const Color(0xFFE6E8EF),
                ),
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
    );
  }

  // RECOMMENDATION HEADER
  Widget _buildRecommendationHeader() {
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Recommended for you',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
              color: Color(0xFF172033),
            ),
          ),
        ),
        TextButton(
          onPressed: _openExploreScreen,
          child: const Text(
            'See all',
            style: TextStyle(
              color: primaryBlue,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  // BOARDING HOUSE CARD
  Widget _buildHouseCard(Map<String, dynamic> house) {
    final String name = (house['name'] ?? 'Unnamed Boarding House')
        .toString();

    // Use the database ID when available so duplicate names
    // do not share the same favorite state.
    final String favoriteKey =
        (house['id'] ?? name).toString();

    final bool isFavorite = favorites.contains(favoriteKey);

    final List<String> amenities = List<String>.from(
      house['amenities'] ?? [],
    );

    final dynamic price = house['price'] ?? 0;

    final String formattedPrice = price is num
        ? price.toStringAsFixed(0)
        : price.toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFEEF0F5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 145,
            width: double.infinity,
            decoration: const BoxDecoration(
              color: Color(0xFFE5ECFA),
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(20),
              ),
            ),
            child: Stack(
              children: [
                Center(
                  child: Icon(
                    house['icon'] is IconData
                        ? house['icon'] as IconData
                        : Icons.home_rounded,
                    size: 65,
                    color: const Color(0xFF8BA7DF),
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: CircleAvatar(
                    backgroundColor: Colors.white,
                    child: IconButton(
                      tooltip: 'Save favorite',
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        setState(() {
                          if (isFavorite) {
                            favorites.remove(favoriteKey);
                          } else {
                            favorites.add(favoriteKey);
                          }
                        });
                      },
                      icon: Icon(
                        isFavorite
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: isFavorite ? Colors.red : Colors.black87,
                        size: 21,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 10,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(
                      '${house['rooms'] ?? 0} rooms available',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF172033),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 16,
                      color: Colors.grey,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '${house['city'] ?? ''} · ${house['location'] ?? ''}',
                        style: const TextStyle(
                          color: Colors.black54,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: amenities.map((amenity) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        amenity,
                        style: const TextStyle(
                          color: Color(0xFF355DAA),
                          fontSize: 11,
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),
                const Divider(
                  height: 1,
                  color: Color(0xFFEEF0F5),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(
                      '₱$formattedPrice',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: primaryBlue,
                      ),
                    ),
                    const Text(
                      ' / month',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                    const Spacer(),
                    const Icon(
                      Icons.arrow_forward_rounded,
                      color: primaryBlue,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // BOTTOM NAVIGATION
  Widget _buildBottomNavigation() {
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: 0,
      selectedItemColor: primaryBlue,
      unselectedItemColor: Colors.grey,
      selectedFontSize: 11,
      unselectedFontSize: 11,
      onTap: (index) {
        if (index == 0) {
          return;
        }

        if (index == 1) {
          _openExploreScreen();
          return;
        }

        if (index == 2) {
          _openCompareScreen();
          return;
        }

        if (index == 3) {
          _openSavedScreen();
          return;
        }

        if (index == 4) {
          _openProfileScreen();
          return;
        }
      },
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home_rounded),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.search_rounded),
          label: 'Explore',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.compare_arrows_rounded),
          label: 'Compare',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.favorite_border_rounded),
          label: 'Saved',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline_rounded),
          label: 'Profile',
        ),
      ],
    );
  }
}
