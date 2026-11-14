<?php

namespace App\Http\Controllers;

class OwnerConversationController extends ConversationController
{
    protected function participantRole(): string
    {
        return 'owner';
    }
}
