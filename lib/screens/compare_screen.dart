
import 'package:flutter/material.dart';

const Color compareBlue = Color(0xFF2563EB);
const Color compareBackground = Color(0xFFF7F8FC);

class CompareScreen extends StatefulWidget {
  final List<Map<String, dynamic>> boardingHouses;

  const CompareScreen({
    super.key,
    required this.boardingHouses,
  });

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final Set<String> selectedHouses = {};

  List<Map<String, dynamic>> get selectedListings {
    return widget.boardingHouses
        .where((house) => selectedHouses.contains(house['name']))
        .toList();
  }

  void toggleHouse(Map<String, dynamic> house) {
    final name = house['name'] as String;

    setState(() {
      if (selectedHouses.contains(name)) {
        selectedHouses.remove(name);
      } else if (selectedHouses.length < 3) {
        selectedHouses.add(name);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You can compare up to 3 boarding houses.'),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: compareBackground,
      appBar: AppBar(
        backgroundColor: compareBackground,
        elevation: 0,
        title: const Text(
          'Compare Boarding Houses',
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.bold,
            color: Color(0xFF172033),
          ),
        ),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Choose your options',
            style: TextStyle(
              fontSize: 23,
              fontWeight: FontWeight.w800,
              color: Color(0xFF172033),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Select up to three boarding houses to compare their prices and features.',
            style: TextStyle(
              color: Colors.black54,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),

          Row(
            children: [
              const Icon(
                Icons.check_circle_outline,
                color: compareBlue,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                '${selectedHouses.length} of 3 selected',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: compareBlue,
                ),
              ),
              const Spacer(),
              if (selectedHouses.isNotEmpty)
                TextButton(
                  onPressed: () {
                    setState(() {
                      selectedHouses.clear();
                    });
                  },
                  child: const Text('Clear'),
                ),
            ],
          ),

          const SizedBox(height: 8),

          ...widget.boardingHouses.map((house) {
            final name = house['name'] as String;
            final selected = selectedHouses.contains(name);

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: selected
                      ? compareBlue
                      : const Color(0xFFEEF0F5),
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: CheckboxListTile(
                value: selected,
                activeColor: compareBlue,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: selected || selectedHouses.length < 3
                    ? (_) => toggleHouse(house)
                    : null,
                title: Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    '${house['city']} · ₱${house['price']} / month',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 12),

          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: selectedHouses.length >= 2
                  ? () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ComparisonResultsScreen(
                            houses: selectedListings,
                          ),
                        ),
                      );
                    }
                  : null,
              icon: const Icon(Icons.compare_arrows_rounded),
              label: const Text(
                'Compare Selected',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: compareBlue,
                foregroundColor: Colors.white,
                disabledBackgroundColor: Colors.grey.shade300,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Select at least two boarding houses to compare.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}

class ComparisonResultsScreen extends StatelessWidget {
  final List<Map<String, dynamic>> houses;

  const ComparisonResultsScreen({
    super.key,
    required this.houses,
  });

  @override
  Widget build(BuildContext context) {
    final lowestRent = houses
        .map((house) => (house['price'] as num).toDouble())
        .reduce((a, b) => a < b ? a : b);

    return Scaffold(
      backgroundColor: compareBackground,
      appBar: AppBar(
        backgroundColor: compareBackground,
        elevation: 0,
        title: const Text(
          'Comparison Results',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF172033),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Compare your choices',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color(0xFF172033),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Review the details before deciding where to stay.',
            style: TextStyle(
              color: Colors.black54,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 20),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(
                const Color(0xFFE5ECFA),
              ),
              border: TableBorder.all(
                color: const Color(0xFFDFE4EF),
                borderRadius: BorderRadius.circular(12),
              ),
              columns: [
                const DataColumn(
                  label: Text(
                    'Feature',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                ...houses.map(
                  (house) => DataColumn(
                    label: SizedBox(
                      width: 145,
                      child: Text(
                        house['name'] as String,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
              rows: [
                _comparisonRow(
                  'Monthly rent',
                  houses.map((house) {
                    final price = (house['price'] as num).toDouble();
                    return '₱${price.toStringAsFixed(0)}';
                  }).toList(),
                ),
                _comparisonRow(
                  'City',
                  houses.map((house) => '${house['city']}').toList(),
                ),
                _comparisonRow(
                  'Location',
                  houses.map((house) => '${house['location']}').toList(),
                ),
                _comparisonRow(
                  'Rooms available',
                  houses.map((house) => '${house['rooms']}').toList(),
                ),
                _comparisonRow(
                  'Amenities',
                  houses.map((house) {
                    return List<String>.from(
                      house['amenities'] ?? [],
                    ).join(', ');
                  }).toList(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFFEEF0F5),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Lowest listed monthly rent',
                  style: TextStyle(
                    color: Colors.black54,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '₱${lowestRent.toStringAsFixed(0)} / month',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: compareBlue,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'A lower rent does not necessarily mean the best choice. Consider location and amenities too.',
                  style: TextStyle(
                    color: Colors.black54,
                    height: 1.5,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  DataRow _comparisonRow(String feature, List<String> values) {
    return DataRow(
      cells: [
        DataCell(
          SizedBox(
            width: 110,
            child: Text(
              feature,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        ...values.map(
          (value) => DataCell(
            SizedBox(
              width: 145,
              child: Text(value),
            ),
          ),
        ),
      ],
    );
  }
}
