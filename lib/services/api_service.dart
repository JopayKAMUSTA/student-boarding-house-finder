
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/material.dart';

class ApiService {

 static const String baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://192.168.1.120:8000/api',
);

  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  // REGISTER
  static Future<Map<String, dynamic>> register({
    required String firstName,
    String? middleName,
    required String lastName,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    final uri = Uri.parse('$baseUrl/register');

    try {
      final response = await http.post(
        uri,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'first_name': firstName,
          'middle_name': middleName ?? '',
          'last_name': lastName,
          'email': email,
          'password': password,
          'password_confirmation': confirmPassword,
        }),
      );

      final dynamic decoded = jsonDecode(response.body);

      if (decoded is Map<String, dynamic>) {
        return {
          ...decoded,
          'success': response.statusCode >= 200 &&
              response.statusCode < 300,
          'status_code': response.statusCode,
        };
      }

      return {
        'success': false,
        'message': 'Unexpected response from the server.',
        'status_code': response.statusCode,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Actual error: $e',
      };
    }
  }

  // LOGIN
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final uri = Uri.parse('$baseUrl/login');

    try {
      final response = await http.post(
        uri,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      final dynamic decoded = jsonDecode(response.body);

      if (decoded is Map<String, dynamic>) {
        return {
          ...decoded,
          'success': response.statusCode >= 200 &&
              response.statusCode < 300,
          'status_code': response.statusCode,
        };
      }

      return {
        'success': false,
        'message': 'Unexpected response from the server.',
        'status_code': response.statusCode,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Actual error: $e',
      };
    }
  }

  // GET AUTHENTICATED STUDENT PROFILE
  static Future<Map<String, dynamic>> getProfile() async {
    try {
      final token = await _storage.read(key: 'auth_token');

      if (token == null || token.isEmpty) {
        return {
          'success': false,
          'message': 'No authentication token found.',
        };
      }

      final response = await http.get(
        Uri.parse('$baseUrl/profile'),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final dynamic decoded = jsonDecode(response.body);

      if (decoded is Map<String, dynamic>) {
        return {
          ...decoded,
          'success': response.statusCode >= 200 &&
              response.statusCode < 300,
          'status_code': response.statusCode,
        };
      }

      return {
        'success': false,
        'message': 'Unexpected response from the server.',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Actual error: $e',
      };
    }
  }



  // LOGOUT
static Future<Map<String, dynamic>> logout() async {
  try {
    final token = await _storage.read(key: 'auth_token');

    if (token == null || token.isEmpty) {
      return {
        'success': false,
        'message': 'No authentication token found.',
      };
    }

    final response = await http.post(
      Uri.parse('$baseUrl/logout'),
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final dynamic decoded = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      await _storage.delete(key: 'auth_token');

      return {
        'success': true,
        'message': 'Logged out successfully.',
      };
    }

    return {
      'success': false,
      'message': decoded is Map<String, dynamic>
          ? decoded['message'] ?? 'Logout failed.'
          : 'Logout failed.',
    };
  } catch (e) {
    return {
      'success': false,
      'message': 'Actual error: $e',
    };
  }
}



static Future<Map<String, dynamic>> getBoardingHouses({
  String? city,
  String? roomType,
  double? maxRent,
}) async {
  try {
    final token = await _storage.read(key: 'auth_token');

    if (token == null || token.isEmpty) {
      return {
        'success': false,
        'message': 'Please log in first.',
      };
    }

    final queryParameters = <String, String>{};

    if (city != null && city != 'All locations') {
      queryParameters['city'] = city;
    }

    if (roomType != null && roomType.isNotEmpty) {
      queryParameters['room_type'] = roomType;
    }

    if (maxRent != null) {
      queryParameters['max_rent'] = maxRent.toString();
    }

    final uri = Uri.parse('$baseUrl/boarding-houses').replace(
      queryParameters: queryParameters.isEmpty ? null : queryParameters,
    );

    final response = await http.get(
      uri,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final decoded = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final List<dynamic> records = decoded['data']['data'];

      final houses = records.map((item) {
        final house = Map<String, dynamic>.from(item);

        return {
          ...house,
          'name': house['name'] ?? 'Unnamed Boarding House',
          'city': house['city'] ?? '',
          'location': house['barangay'] ?? house['address'] ?? '',
          'address': house['address'] ?? '',
          'price': double.tryParse(
                house['monthly_rent']?.toString() ?? '0',
              ) ??
              0.0,
          'rooms': house['available_rooms'] ?? 0,
          'amenities': List<String>.from(
            house['amenities'] ?? [],
          ),
          'description': house['description'] ?? '',
          'icon': Icons.home_rounded,
        };
      }).toList();

      return {
        'success': true,
        'data': houses,
        'current_page': decoded['data']['current_page'],
        'last_page': decoded['data']['last_page'],
        'total': decoded['data']['total'],
      };
    }

    return {
      'success': false,
      'message': decoded['message'] ?? 'Unable to load boarding houses.',
    };
  } catch (e) {
    return {
      'success': false,
      'message': 'Error loading boarding houses: $e',
    };
  }
}
}

