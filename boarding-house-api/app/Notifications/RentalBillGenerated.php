<?php

namespace App\Notifications;

use App\Models\RentalBill;
use App\Models\RoomAssignment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RentalBillGenerated extends Notification
{
    use Queueable;

    public function __construct(
        public RentalBill $bill,
        public RoomAssignment $assignment
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $this->assignment->loadMissing([
            'boardingHouseRoom.boardingHouse',
        ]);

        $room = $this->assignment->boardingHouseRoom;
        $house = $room?->boardingHouse;

        return [
            'type' => 'rental_bill',
            'title' => 'New Rental Bill',
            'message' => 'A new rental bill has been generated for your room.',
            'bill_id' => $this->bill->id,
            'amount' => $this->bill->amount,
            'due_date' => $this->bill->due_date?->toDateString(),
            'rental_period_start' => $this->bill->rental_period_start?->toDateString(),
            'rental_period_end' => $this->bill->rental_period_end?->toDateString(),
            'boarding_house_name' => $house?->name,
            'room_number' => $room?->room_number,
            'screen' => 'rental_payments',
        ];
    }
}
