import 'package:flutter/material.dart';

import 'boarding_house_details_screen.dart';
import 'compare_screen.dart';
import 'saved_screen.dart';
import 'explore_screen.dart';
import 'profile_screen.dart';
import 'student_conversations_screen.dart';
import 'rental_payments_screen.dart';
import 'notifications_screen.dart';
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

  int unreadNotificationCount = 0;

  List<Map<String, dynamic>> boardingHouses = [];

  final Set<String> favorites = {};

  @override
  void initState() {
    super.initState();
    _loadBoardingHouses();
    _loadUnreadNotifications();
  }

  // LOAD BOARDING HOUSES FROM LARAVEL API
  Future<void> _loadBoardingHouses() async {
    if (isLoading && boardingHouses.isNotEmpty) return;

    if (mounted) {
      setState(() {
        isLoading = true;
        errorMessage = null;
      });
    }

    try {
      final result = await ApiService.getBoardingHouses();

      if (!mounted) return;

      if (result['success'] == true) {
        final rawData = result['data'];

        final houses = rawData is List
            ? rawData
                  .whereType<Map>()
                  .map((house) => Map<String, dynamic>.from(house))
                  .toList()
            : <Map<String, dynamic>>[];

        setState(() {
          boardingHouses = houses;
          isLoading = false;
          errorMessage = null;
        });
      } else {
        setState(() {
          errorMessage = result['message'] ?? 'Failed to load boarding houses.';
          isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        errorMessage = 'Unable to connect to the server. Please try again.';
        isLoading = false;
      });

      debugPrint('Boarding house loading error: $e');
    }
  }

  // LOAD UNREAD NOTIFICATION COUNT
  Future<void> _loadUnreadNotifications() async {
    try {
      final result = await ApiService.getStudentNotifications();

      if (!mounted) return;

      if (result['success'] == true) {
        setState(() {
          unreadNotificationCount =
              int.tryParse(result['unread_count']?.toString() ?? '0') ?? 0;
        });
      }
    } catch (e) {
      debugPrint('Notification count error: $e');
    }
  }

  // OPEN NOTIFICATIONS
  Future<void> _openNotificationsScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
    );

    if (!mounted) return;

    await _loadUnreadNotifications();
  }

  // SAFELY CONVERT AMENITIES
  List<String> _getAmenities(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }

    return [];
  }

  // OPEN PROFILE
  Future<void> _openProfileScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ProfileScreen()),
    );

    if (!mounted) return;
    setState(() {});
  }

  // OPEN MESSAGES
  Future<void> _openMessagesScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentConversationsScreen()),
    );
  }

  // OPEN RENTAL PAYMENTS
  Future<void> _openRentalPaymentsScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const RentalPaymentsScreen()),
    );
  }

  // OPEN EXPLORE
  Future<void> _openExploreScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ExploreScreen(boardingHouses: boardingHouses),
      ),
    );

    if (!mounted) return;
    await _loadBoardingHouses();
  }

  // OPEN SAVED
  Future<void> _openSavedScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SavedScreen(
          boardingHouses: boardingHouses,
          favorites: favorites,
          onFavoritesChanged: () {
            if (mounted) {
              setState(() {});
            }
          },
        ),
      ),
    );

    if (!mounted) return;
    setState(() {});
  }

  // OPEN COMPARE
  Future<void> _openCompareScreen() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CompareScreen(boardingHouses: boardingHouses),
      ),
    );

    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final query = searchQuery.trim().toLowerCase();

    final visibleHouses = boardingHouses.where((house) {
      final city = (house['city'] ?? '').toString();

      final matchesCity =
          selectedCity == 'All locations' ||
          city.toLowerCase() == selectedCity.toLowerCase();

      final amenities = _getAmenities(house['amenities']);

      final searchableText = [
        house['name'],
        house['city'],
        house['location'],
        house['address'],
        house['description'],
        ...amenities,
      ].map((value) => (value ?? '').toString().toLowerCase());

      final matchesSearch =
          query.isEmpty || searchableText.any((value) => value.contains(query));

      return matchesCity && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: pageBackground,
      body: SafeArea(
        child: RefreshIndicator(
          color: primaryBlue,
          onRefresh: () async {
            await _loadBoardingHouses();
            await _loadUnreadNotifications();
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
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

              const SliverToBoxAdapter(child: SizedBox(height: 20)),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  // LOADING, ERROR, EMPTY AND SUCCESS STATES
  Widget _buildBoardingHouseResults(List<Map<String, dynamic>> visibleHouses) {
    if (isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 50),
        child: Center(child: CircularProgressIndicator(color: primaryBlue)),
      );
    }

    if (errorMessage != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(Icons.wifi_off_rounded, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.black87),
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
            Icon(Icons.search_off_rounded, size: 48, color: Colors.grey),
            SizedBox(height: 12),
            Text(
              'No boarding houses found',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 6),
            Text(
              'Try another name or location.',
              style: TextStyle(color: Colors.grey),
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
                  builder: (context) =>
                      BoardingHouseDetailsScreen(house: house),
                ),
              );
            },
            child: _buildHouseCard(house),
          ),
        );
      }).toList(),
    );
  }

  // HEADER WITH NOTIFICATION AND PROFILE
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
          child: const Icon(Icons.house_rounded, color: Colors.white, size: 27),
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
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ),
        const Spacer(),

        // NOTIFICATION BELL
        Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: const Color(0xFFE4ECFF),
              child: IconButton(
                tooltip: 'Notifications',
                onPressed: _openNotificationsScreen,
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: primaryBlue,
                  size: 23,
                ),
              ),
            ),

            // UNREAD NOTIFICATION BADGE
            if (unreadNotificationCount > 0)
              Positioned(
                right: -5,
                top: -5,
                child: Container(
                  constraints: const BoxConstraints(
                    minWidth: 19,
                    minHeight: 19,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      unreadNotificationCount > 99
                          ? '99+'
                          : unreadNotificationCount.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),

        const SizedBox(width: 10),

        // PROFILE BUTTON
        CircleAvatar(
          radius: 22,
          backgroundColor: const Color(0xFFE4ECFF),
          child: IconButton(
            tooltip: 'Profile',
            onPressed: _openProfileScreen,
            icon: const Icon(Icons.person_outline_rounded, color: primaryBlue),
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
          style: TextStyle(fontSize: 14, color: Colors.black54),
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
        prefixIcon: const Icon(Icons.search_rounded, color: primaryBlue),
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
          borderSide: const BorderSide(color: Color(0xFFEEF0F5)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primaryBlue),
        ),
      ),
    );
  }

  // CITY FILTERS
  Widget _buildCityFilters() {
    final cities = ['All locations', 'Tagum City', 'Davao City'];

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
                  color: selected ? primaryBlue : const Color(0xFFE6E8EF),
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
            style: TextStyle(color: primaryBlue, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  // IMAGE PLACEHOLDER
  Widget _buildImagePlaceholder() {
    return Container(
      width: double.infinity,
      height: 180,
      color: const Color(0xFFE5ECFA),
      child: const Center(
        child: Icon(Icons.home_rounded, size: 65, color: Color(0xFF8BA7DF)),
      ),
    );
  }

  // BOARDING HOUSE CARD
  Widget _buildHouseCard(Map<String, dynamic> house) {
    final String name = (house['name'] ?? 'Unnamed Boarding House').toString();

    final String favoriteKey = (house['id'] ?? name).toString();

    final bool isFavorite = favorites.contains(favoriteKey);

    final List<String> amenities = _getAmenities(house['amenities']);

    final dynamic price = house['price'] ?? house['monthly_rent'] ?? 0;

    final String formattedPrice = price is num
        ? price.toStringAsFixed(0)
        : price.toString();

    String? imageUrl = house['cover_image_url']?.toString();

    if (imageUrl == null || imageUrl.isEmpty) {
      imageUrl = house['image_url']?.toString();
    }

    if (imageUrl != null && imageUrl.isEmpty) {
      imageUrl = null;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEEF0F5)),
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
          SizedBox(
            height: 180,
            width: double.infinity,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(20),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (imageUrl != null)
                    Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: 180,
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) {
                          return child;
                        }

                        return Container(
                          color: const Color(0xFFE5ECFA),
                          child: const Center(
                            child: CircularProgressIndicator(
                              color: primaryBlue,
                            ),
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        debugPrint('IMAGE LOAD ERROR: $imageUrl');
                        debugPrint('$error');

                        return _buildImagePlaceholder();
                      },
                    )
                  else
                    _buildImagePlaceholder(),

                  // FAVORITE BUTTON
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

                  // AVAILABLE ROOMS
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
                        '${house['rooms'] ?? house['available_rooms'] ?? 0} rooms available',
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
          ),

          // BOARDING HOUSE INFORMATION
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
                        '${house['city'] ?? ''} · ${house['location'] ?? house['address'] ?? ''}',
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
                const Divider(height: 1, color: Color(0xFFEEF0F5)),
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
                      style: TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                    const Spacer(),
                    const Icon(Icons.arrow_forward_rounded, color: primaryBlue),
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
      selectedFontSize: 10,
      unselectedFontSize: 10,
      onTap: (index) {
        if (index == 0) {
          return;
        } else if (index == 1) {
          _openExploreScreen();
        } else if (index == 2) {
          _openCompareScreen();
        } else if (index == 3) {
          _openSavedScreen();
        } else if (index == 4) {
          _openMessagesScreen();
        } else if (index == 5) {
          _openRentalPaymentsScreen();
        }
      },
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
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
          icon: Icon(Icons.chat_bubble_outline_rounded),
          label: 'Messages',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.receipt_long_rounded),
          label: 'Payments',
        ),
      ],
    );
  }
}
