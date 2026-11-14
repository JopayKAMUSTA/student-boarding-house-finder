<?php

namespace App\Http\Controllers;

class StudentConversationController extends ConversationController
{
    protected function participantRole(): string
    {
        return 'student';
    }
}
