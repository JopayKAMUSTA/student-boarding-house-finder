
import 'package:flutter_test/flutter_test.dart';
import 'package:tagstay/main.dart';

void main() {
  testWidgets('TagStay app loads successfully', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('Welcome to TagStay'), findsOneWidget);
    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Log In'), findsOneWidget);
  });
}
