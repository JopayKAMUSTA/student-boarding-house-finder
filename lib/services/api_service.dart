
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.72.172.51:8000/api',
  );

  static const FlutterSecureStorage _storage =
      FlutterSecureStorage();

  static const Duration _requestTimeout =
      Duration(seconds: 15);

  // ============================================================
  // IMAGE URL HELPERS
  // ============================================================

  // GET THE LARAVEL SERVER ADDRESS WITHOUT /api
  static Uri get _serverUri {
    final apiUri = Uri.parse(baseUrl);

    return Uri(
      scheme: apiUri.scheme,
      host: apiUri.host,
      port: apiUri.hasPort ? apiUri.port : null,
    );
  }

  // CONVERT IMAGE PATHS INTO ACCESSIBLE URLS
  // PUBLIC METHOD: CAN ALSO BE USED BY SCREEN FILES.
  static String? resolveImageUrl(dynamic value) {
    if (value == null) return null;

    String imagePath = value.toString().trim();

    if (imagePath.isEmpty) return null;

    final serverUri = _serverUri;
    final imageUri = Uri.tryParse(imagePath);

    // Handle absolute URLs.
    if (imageUri != null &&
        (imageUri.scheme == 'http' ||
            imageUri.scheme == 'https')) {
      // Replace localhost with the configured server address.
      if (imageUri.host == 'localhost' ||
          imageUri.host == '127.0.0.1' ||
          imageUri.host == '0.0.0.0') {
        return imageUri
            .replace(
              scheme: serverUri.scheme,
              host: serverUri.host,
              port: serverUri.hasPort ? serverUri.port : null,
            )
            .toString();
      }

      return imageUri.toString();
    }

    // Remove public/ prefix.
    imagePath = imagePath.replaceFirst(
      RegExp(r'^/?public/'),
      '',
    );

    // Remove leading slashes.
    imagePath = imagePath.replaceFirst(
      RegExp(r'^/+'),
      '',
    );

    // Avoid adding storage twice.
    if (imagePath.startsWith('storage/')) {
      return serverUri.resolve('/$imagePath').toString();
    }

    // Handle Laravel storage paths.
    return serverUri.resolve('/storage/$imagePath').toString();
  }

  // GET IMAGE VALUE FROM DIFFERENT POSSIBLE API FIELD NAMES
  static dynamic _getImageValue(Map image) {
    return image['url'] ??
        image['image_url'] ??
        image['image_path'] ??
        image['path'] ??
        image['file_path'] ??
        image['filename'];
  }

  // NORMALIZE AN IMAGE LIST
  static List<Map<String, dynamic>> _normalizeImages(
    dynamic images,
  ) {
    if (images is! List) {
      return [];
    }

    final normalized = <Map<String, dynamic>>[];

    for (final image in images) {
      dynamic imageValue;

      if (image is Map) {
        imageValue = _getImageValue(image);
      } else if (image is String) {
        imageValue = image;
      }

      final url = resolveImageUrl(imageValue);

      if (url == null) continue;

      final normalizedImage = image is Map
          ? Map<String, dynamic>.from(image)
          : <String, dynamic>{};

      normalizedImage['url'] = url;

      if (!normalized.any((item) => item['url'] == url)) {
        normalized.add(normalizedImage);
      }
    }

    return normalized;
  }

  // NORMALIZE BOARDING HOUSE AND ROOM IMAGES
  static Map<String, dynamic> _normalizeBoardingHouse(
    Map<String, dynamic> house,
  ) {
    final normalized = Map<String, dynamic>.from(house);

    final images = _normalizeImages(normalized['images']);

    String? coverImage = resolveImageUrl(
      normalized['cover_image_url'],
    );

    String? imageUrl = resolveImageUrl(
      normalized['image_url'],
    );

    // Use the first gallery image if no cover image exists.
    if (coverImage == null && images.isNotEmpty) {
      coverImage = images.first['url']?.toString();
    }

    if (imageUrl == null && images.isNotEmpty) {
      imageUrl = images.first['url']?.toString();
    }

    normalized['images'] = images;
    normalized['cover_image_url'] = coverImage;
    normalized['image_url'] = imageUrl;

    // Normalize individual room images.
    final dynamic roomsData = normalized['rooms'];

    if (roomsData is List) {
      normalized['rooms'] = roomsData.map((room) {
        if (room is! Map) {
          return <String, dynamic>{};
        }

        final roomData = Map<String, dynamic>.from(room);

        roomData['images'] = _normalizeImages(
          roomData['images'],
        );

        final roomImageUrl = resolveImageUrl(
          roomData['image_url'],
        );

        if (roomImageUrl != null) {
          roomData['image_url'] = roomImageUrl;
        }

        return roomData;
      }).toList();
    } else {
      normalized['rooms'] = [];
    }

    return normalized;
  }

  // ============================================================
  // COMMON RESPONSE HANDLER
  // ============================================================

  static Map<String, dynamic> _handleResponse(
    http.Response response,
  ) {
    dynamic decoded;

    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      return {
        'success': false,
        'message': 'Invalid response from the server.',
        'status_code': response.statusCode,
      };
    }

    if (decoded is Map<String, dynamic>) {
      return {
        ...decoded,
        'success':
            response.statusCode >= 200 &&
            response.statusCode < 300,
        'status_code': response.statusCode,
      };
    }

    return {
      'success': false,
      'message': 'Unexpected response from the server.',
      'status_code': response.statusCode,
    };
  }

  static Map<String, dynamic> _handleError(dynamic error) {
    return {
      'success': false,
      'message': 'Connection error: $error',
    };
  }

  // ============================================================
  // AUTHENTICATION HEADERS
  // ============================================================

  static Future<Map<String, String>> _authHeaders() async {
    final token = await _storage.read(key: 'auth_token');

    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty)
        'Authorization': 'Bearer $token',
    };
  }

  static Future<String?> _getAuthToken() async {
    final token = await _storage.read(key: 'auth_token');

    if (token == null || token.isEmpty) return null;

    return token;
  }

  // ============================================================
  // REGISTER STUDENT
  // ============================================================

  static Future<Map<String, dynamic>> register({
    required String firstName,
    String? middleName,
    required String lastName,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/register'),
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
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('REGISTER ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // LOGIN STUDENT
  // ============================================================

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/login'),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'email': email,
              'password': password,
            }),
          )
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] == true) {
        final data = result['data'];
        final token = result['token'] ??
            (data is Map ? data['token'] : null);

        if (token != null && token.toString().isNotEmpty) {
          await _storage.write(
            key: 'auth_token',
            value: token.toString(),
          );
        }
      }

      return result;
    } catch (e) {
      debugPrint('LOGIN ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // GET PROFILE
  // ============================================================

  static Future<Map<String, dynamic>> getProfile() async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'No authentication token found.',
        };
      }

      final response = await http
          .get(
            Uri.parse('$baseUrl/profile'),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('PROFILE ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  static Future<Map<String, dynamic>> logout() async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'No authentication token found.',
        };
      }

      final response = await http
          .post(
            Uri.parse('$baseUrl/logout'),
            headers: headers,
          )
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] == true) {
        await _storage.delete(key: 'auth_token');
      }

      return result;
    } catch (e) {
      debugPrint('LOGOUT ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // GET BOARDING HOUSES
  // ============================================================

  static Future<Map<String, dynamic>> getBoardingHouses({
    String? city,
    String? roomType,
    double? maxRent,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
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
        queryParameters:
            queryParameters.isEmpty ? null : queryParameters,
      );

      final response = await http
          .get(uri, headers: headers)
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] != true) return result;

      final dynamic data = result['data'];

      final List<dynamic> records = data is List
          ? data
          : data is Map && data['data'] is List
              ? data['data']
              : [];

      final houses = records
          .whereType<Map>()
          .map((item) {
            final house = _normalizeBoardingHouse(
              Map<String, dynamic>.from(item),
            );

            final amenities = house['amenities'];

            return {
              ...house,
              'name': house['name'] ??
                  'Unnamed Boarding House',
              'city': house['city'] ?? '',
              'location': house['barangay'] ??
                  house['address'] ??
                  '',
              'address': house['address'] ?? '',
              'price': double.tryParse(
                    house['monthly_rent']?.toString() ?? '0',
                  ) ??
                  0.0,
              'rooms': house['available_rooms'] ?? 0,
              'amenities': amenities is List
                  ? amenities.map((e) => e.toString()).toList()
                  : <String>[],
              'description': house['description'] ?? '',
              'icon': Icons.home_rounded,
            };
          })
          .toList();

      final pagination = data is Map
          ? data
          : <String, dynamic>{};

      return {
        'success': true,
        'data': houses,
        'current_page': pagination['current_page'] ?? 1,
        'last_page': pagination['last_page'] ?? 1,
        'total': pagination['total'] ?? houses.length,
      };
    } catch (e) {
      debugPrint('BOARDING HOUSES ERROR: $e');

      return {
        'success': false,
        'message': 'Error loading boarding houses: $e',
      };
    }
  }

  // ============================================================
  // GET SINGLE BOARDING HOUSE DETAILS
  // ============================================================

  static Future<Map<String, dynamic>> getBoardingHouseDetails({
    required int id,
  }) async {
    try {
      final headers = await _authHeaders();

      final uri = Uri.parse('$baseUrl/boarding-houses/$id');

      final response = await http
          .get(uri, headers: headers)
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] != true) return result;

      final dynamic data = result['data'];

      if (data is! Map) {
        return {
          'success': false,
          'message': 'Invalid boarding house details response.',
        };
      }

      final house = _normalizeBoardingHouse(
        Map<String, dynamic>.from(data),
      );

      return {
        'success': true,
        'data': house,
      };
    } catch (e) {
      debugPrint('BOARDING HOUSE DETAILS ERROR: $e');

      return {
        'success': false,
        'message': 'Error loading boarding house details: $e',
      };
    }
  }

  // ============================================================
  // CREATE OR RETRIEVE STUDENT CONVERSATION
  // ============================================================

  static Future<Map<String, dynamic>> createStudentConversation({
    required int boardingHouseId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .post(
            Uri.parse('$baseUrl/student/conversations'),
            headers: headers,
            body: jsonEncode({
              'boarding_house_id': boardingHouseId,
            }),
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('STUDENT CONVERSATION ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // GET ALL STUDENT CONVERSATIONS
  // ============================================================

  static Future<Map<String, dynamic>> getStudentConversations() async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .get(
            Uri.parse('$baseUrl/student/conversations'),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('GET STUDENT CONVERSATIONS ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // GET STUDENT CONVERSATION MESSAGES
  // ============================================================

  static Future<Map<String, dynamic>>
      getStudentConversationMessages({
    required int conversationId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .get(
            Uri.parse(
              '$baseUrl/student/conversations/'
              '$conversationId/messages',
            ),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('GET STUDENT MESSAGES ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // SEND STUDENT MESSAGE
  // ============================================================

  static Future<Map<String, dynamic>> sendStudentMessage({
    required int conversationId,
    required String message,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .post(
            Uri.parse(
              '$baseUrl/student/conversations/'
              '$conversationId/messages',
            ),
            headers: headers,
            body: jsonEncode({'body': message}),
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('SEND STUDENT MESSAGE ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // DOWNLOAD STUDENT MESSAGE IMAGE ATTACHMENT
  // ============================================================

  static Future<Uint8List?> getStudentMessageAttachment({
    required int conversationId,
    required int attachmentId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        debugPrint(
          'ATTACHMENT ERROR: No authentication token found.',
        );
        return null;
      }

      final uri = Uri.parse(
        '$baseUrl/student/conversations/'
        '$conversationId/attachments/$attachmentId',
      );

      final response = await http
          .get(
            uri,
            headers: {
              'Accept': '*/*',
              'Authorization': headers['Authorization']!,
            },
          )
          .timeout(_requestTimeout);

      if (response.statusCode != 200 ||
          response.bodyBytes.isEmpty) {
        debugPrint('ATTACHMENT ERROR: ${response.body}');
        return null;
      }

      final bytes = response.bodyBytes;

      const pngSignature = [
        0x89,
        0x50,
        0x4E,
        0x47,
        0x0D,
        0x0A,
        0x1A,
      ];

      var signaturePosition = -1;

      for (var i = 0;
          i <= bytes.length - pngSignature.length;
          i++) {
        var matches = true;

        for (var j = 0; j < pngSignature.length; j++) {
          if (bytes[i + j] != pngSignature[j]) {
            matches = false;
            break;
          }
        }

        if (matches) {
          signaturePosition = i;
          break;
        }
      }

      if (signaturePosition >= 0) {
        return Uint8List.fromList(
          bytes.sublist(signaturePosition),
        );
      }

      debugPrint('ATTACHMENT ERROR: PNG signature not found.');
      return null;
    } catch (e, stackTrace) {
      debugPrint('GET STUDENT ATTACHMENT ERROR: $e');
      debugPrint('$stackTrace');
      return null;
    }
  }

  // ============================================================
  // MARK STUDENT CONVERSATION AS READ
  // ============================================================

  static Future<Map<String, dynamic>>
      markStudentConversationAsRead({
    required int conversationId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .post(
            Uri.parse(
              '$baseUrl/student/conversations/'
              '$conversationId/read',
            ),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('MARK STUDENT MESSAGES AS READ ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // STUDENT RENTAL PAYMENTS
  // ============================================================

  // GET STUDENT RENTAL BILLS
  static Future<Map<String, dynamic>> getStudentRentalBills({
    int perPage = 50,
    int page = 1,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final uri = Uri.parse('$baseUrl/student/rental-bills').replace(
        queryParameters: {
          'per_page': perPage.toString(),
          'page': page.toString(),
        },
      );

      final response = await http
          .get(uri, headers: headers)
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] != true) return result;

      final dynamic pagination = result['data'];

      if (pagination is! Map) {
        return {
          'success': false,
          'message': 'Invalid rental bills response.',
        };
      }

      final dynamic records = pagination['data'];

      final bills = records is List
          ? records
              .whereType<Map>()
              .map((bill) => Map<String, dynamic>.from(bill))
              .toList()
          : <Map<String, dynamic>>[];

      return {
        ...result,
        'data': bills,
        'current_page': pagination['current_page'] ?? page,
        'last_page': pagination['last_page'] ?? 1,
        'per_page': pagination['per_page'] ?? perPage,
        'total': pagination['total'] ?? bills.length,
      };
    } catch (e) {
      debugPrint('GET STUDENT RENTAL BILLS ERROR: $e');
      return _handleError(e);
    }
  }

  // GET PAYMENT METHODS FOR A RENTAL BILL
  static Future<Map<String, dynamic>>
      getStudentBillPaymentMethods({
    required int billId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final uri = Uri.parse(
        '$baseUrl/student/rental-bills/$billId/payment-methods',
      );

      final response = await http
          .get(uri, headers: headers)
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] != true) return result;

      final dynamic records = result['data'];

      final methods = records is List
          ? records
              .whereType<Map>()
              .map((method) => Map<String, dynamic>.from(method))
              .toList()
          : <Map<String, dynamic>>[];

      return {
        ...result,
        'data': methods,
      };
    } catch (e) {
      debugPrint('GET STUDENT PAYMENT METHODS ERROR: $e');
      return _handleError(e);
    }
  }

  // COMPATIBILITY ALIAS
  static Future<Map<String, dynamic>>
      getStudentRentalPaymentMethods({
    required int billId,
  }) async {
    return getStudentBillPaymentMethods(billId: billId);
  }

  // DOWNLOAD PAYMENT METHOD QR CODE
  static Future<Uint8List?> getStudentPaymentMethodQr({
    required int billId,
    required int paymentMethodId,
  }) async {
    try {
      final token = await _getAuthToken();

      if (token == null) {
        debugPrint('PAYMENT QR ERROR: No authentication token.');
        return null;
      }

      final uri = Uri.parse(
        '$baseUrl/student/rental-bills/$billId/'
        'payment-methods/$paymentMethodId/qr',
      );

      final response = await http
          .get(
            uri,
            headers: {
              'Accept': '*/*',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(_requestTimeout);

      if (response.statusCode != 200 ||
          response.bodyBytes.isEmpty) {
        debugPrint('PAYMENT QR ERROR: ${response.body}');
        return null;
      }

      return response.bodyBytes;
    } catch (e) {
      debugPrint('GET STUDENT PAYMENT QR ERROR: $e');
      return null;
    }
  }

  // COMPATIBILITY ALIAS
  static Future<Uint8List?> getStudentRentalPaymentQr({
    required int billId,
    required int paymentMethodId,
  }) async {
    return getStudentPaymentMethodQr(
      billId: billId,
      paymentMethodId: paymentMethodId,
    );
  }

  // SUBMIT STUDENT RENTAL PAYMENT WITH PROOF
  static Future<Map<String, dynamic>>
      submitStudentRentalPayment({
    required int billId,
    required String amount,
    required String paymentDate,
    String? referenceNumber,
    String? notes,
    required Uint8List proofBytes,
    required String proofFileName,
  }) async {
    try {
      final token = await _getAuthToken();

      if (token == null) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      if (proofBytes.isEmpty) {
        return {
          'success': false,
          'message': 'The selected payment proof is empty.',
        };
      }

      if (proofBytes.length > 5 * 1024 * 1024) {
        return {
          'success': false,
          'message': 'Payment proof must not exceed 5 MB.',
        };
      }

      final uri = Uri.parse(
        '$baseUrl/student/rental-bills/'
        '$billId/payment-submissions',
      );

      final request = http.MultipartRequest('POST', uri);

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      });

      request.fields['amount'] = amount;
      request.fields['payment_date'] = paymentDate;

      final combinedNotes = [
        if (referenceNumber != null &&
            referenceNumber.trim().isNotEmpty)
          'Reference number: ${referenceNumber.trim()}',
        if (notes != null && notes.trim().isNotEmpty)
          notes.trim(),
      ].join('\n');

      if (combinedNotes.length > 1000) {
        return {
          'success': false,
          'message':
              'Reference number and notes must not exceed 1000 characters.',
        };
      }

      if (combinedNotes.isNotEmpty) {
        request.fields['notes'] = combinedNotes;
      }

      request.files.add(
        http.MultipartFile.fromBytes(
          'proof',
          proofBytes,
          filename: proofFileName,
        ),
      );

      final streamedResponse = await request
          .send()
          .timeout(_requestTimeout);

      final response = await http.Response.fromStream(
        streamedResponse,
      );

      debugPrint(
        'SUBMIT RENTAL PAYMENT STATUS: ${response.statusCode}',
      );
      debugPrint(
        'SUBMIT RENTAL PAYMENT RESPONSE: ${response.body}',
      );

      return _handleResponse(response);
    } catch (e) {
      debugPrint('SUBMIT STUDENT RENTAL PAYMENT ERROR: $e');
      return _handleError(e);
    }
  }

  // ============================================================
  // STUDENT NOTIFICATIONS
  // ============================================================

  // GET STUDENT NOTIFICATIONS
  static Future<Map<String, dynamic>>
      getStudentNotifications({
    int perPage = 20,
    int page = 1,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final uri = Uri.parse('$baseUrl/student/notifications').replace(
        queryParameters: {
          'per_page': perPage.toString(),
          'page': page.toString(),
        },
      );

      final response = await http
          .get(uri, headers: headers)
          .timeout(_requestTimeout);

      final result = _handleResponse(response);

      if (result['success'] != true) return result;

      final dynamic pagination = result['data'];

      if (pagination is! Map) {
        return {
          'success': false,
          'message': 'Invalid notifications response.',
        };
      }

      final dynamic records = pagination['data'];

      final notifications = records is List
          ? records
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : <Map<String, dynamic>>[];

      return {
        ...result,
        'data': notifications,
        'unread_count': result['unread_count'] ?? 0,
        'current_page': pagination['current_page'] ?? page,
        'last_page': pagination['last_page'] ?? 1,
        'total': pagination['total'] ?? notifications.length,
      };
    } catch (e) {
      debugPrint('GET STUDENT NOTIFICATIONS ERROR: $e');
      return _handleError(e);
    }
  }

  // MARK ONE STUDENT NOTIFICATION AS READ
  static Future<Map<String, dynamic>>
      markStudentNotificationAsRead({
    required String notificationId,
  }) async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .patch(
            Uri.parse(
              '$baseUrl/student/notifications/'
              '$notificationId/read',
            ),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('MARK STUDENT NOTIFICATION AS READ ERROR: $e');
      return _handleError(e);
    }
  }

  // MARK ALL STUDENT NOTIFICATIONS AS READ
  static Future<Map<String, dynamic>>
      markAllStudentNotificationsAsRead() async {
    try {
      final headers = await _authHeaders();

      if (!headers.containsKey('Authorization')) {
        return {
          'success': false,
          'message': 'Please log in first.',
        };
      }

      final response = await http
          .patch(
            Uri.parse(
              '$baseUrl/student/notifications/read-all',
            ),
            headers: headers,
          )
          .timeout(_requestTimeout);

      return _handleResponse(response);
    } catch (e) {
      debugPrint('MARK ALL STUDENT NOTIFICATIONS AS READ ERROR: $e');
      return _handleError(e);
    }
  }
}
