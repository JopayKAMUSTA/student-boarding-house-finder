<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Boardinghouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ReportController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        if (!in_array($user->role, ['owner', 'student'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only owners and students can submit reports.',
            ], 403);
        }

        $allowedTargets = $user->role === 'owner'
            ? 'tenant'
            : 'user,boarding_house';

        $validated = $request->validate([
            'target_type' => 'required|in:' . $allowedTargets,
            'target_id' => 'required|integer|min:1',
            'category' => 'required|string|max:100',
            'title' => 'required|string|max:255',
            'description' => 'required|string|max:5000',
            'evidence' => 'nullable|array|max:5',
            'evidence.*' => 'file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $target = $this->findValidTarget(
            $user,
            $validated['target_type'],
            (int) $validated['target_id']
        );

        if (!$target) {
            return response()->json([
                'success' => false,
                'message' => 'The selected person or boarding house cannot be reported.',
            ], 404);
        }

        $storedFiles = [];

        try {
            $report = DB::transaction(function () use (
                $request,
                $user,
                $validated,
                $target,
                &$storedFiles
            ) {
                $report = Report::create([
                    'reporter_id' => $user->id,
                    'reporter_role' => $user->role,
                    'target_type' => $validated['target_type'],
                    'target_id' => $validated['target_id'],
                    'target_name' => $this->getTargetName($target),
                    'category' => $validated['category'],
                    'title' => $validated['title'],
                    'description' => $validated['description'],
                    'status' => 'submitted',
                ]);

                foreach ($request->file('evidence', []) as $file) {
                    $path = $file->store('report-evidence', 'local');

                    if (!$path) {
                        throw new \RuntimeException(
                            'Failed to store evidence file.'
                        );
                    }

                    $storedFiles[] = $path;

                    $report->evidence()->create([
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                        'file_type' => $file->getMimeType(),
                    ]);
                }

                return $report;
            });
        } catch (\Throwable $exception) {
            foreach ($storedFiles as $path) {
                Storage::disk('local')->delete($path);
            }

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Report submitted successfully.',
            'data' => [
                'id' => $report->id,
                'status' => $report->status,
                'created_at' => $report->created_at,
            ],
        ], 201);
    }

    private function findValidTarget($user, string $type, int $id)
    {
        if ($type === 'tenant') {
            if ($user->role !== 'owner') {
                return null;
            }

            return Tenant::where('id', $id)
                ->where('owner_id', $user->id)
                ->first();
        }

        if ($type === 'user') {
            $target = User::find($id);

            if (!$target || $target->id === $user->id) {
                return null;
            }

            if ($user->role === 'owner' && $target->role !== 'student') {
                return null;
            }

            if ($user->role === 'student' && $target->role !== 'owner') {
                return null;
            }

            return $target;
        }

        if ($type === 'boarding_house') {
            if ($user->role !== 'student') {
                return null;
            }

            return Boardinghouse::find($id);
        }

        return null;
    }

    private function getTargetName($target): string
    {
        if ($target instanceof Tenant) {
            return $target->full_name ?: 'Tenant #' . $target->id;
        }

        return $target->name ?? 'Record #' . $target->id;
    }
}
