<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AdminReportedInformationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Unauthorized access.'
        );

        $reports = Report::with('reporter:id,name')
            ->withCount('evidence')
            ->latest()
            ->get()
            ->map(function ($report) {
                return [
                    'id' => $report->id,
                    'title' => $report->title,
                    'description' => $report->description,
                    'reporter_name' => $report->reporter?->name ?? 'Unknown User',
                    'reporter_role' => $report->reporter_role,
                    'target_type' => $report->target_type,
                    'target_id' => $report->target_id,
                    'target_name' => $report->target_name,
                    'category' => $report->category,
                    'status' => $report->status,
                    'evidence_count' => $report->evidence_count,
                    'admin_notes' => $report->admin_notes,
                    'created_at' => $report->created_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    public function show(Request $request, Report $report): JsonResponse
    {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Unauthorized access.'
        );

        $report->load([
            'reporter:id,name',
            'evidence:id,report_id,original_name,file_type,created_at',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $report->id,
                'title' => $report->title,
                'description' => $report->description,
                'reporter_name' => $report->reporter?->name ?? 'Unknown User',
                'reporter_role' => $report->reporter_role,
                'target_type' => $report->target_type,
                'target_id' => $report->target_id,
                'target_name' => $report->target_name,
                'category' => $report->category,
                'status' => $report->status,
                'admin_notes' => $report->admin_notes,
                'evidence' => $report->evidence,
                'created_at' => $report->created_at,
            ],
        ]);
    }

    public function update(Request $request, Report $report): JsonResponse
    {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Unauthorized access.'
        );

        $validated = $request->validate([
            'status' => 'required|in:submitted,under_review,awaiting_response,resolved,dismissed',
            'admin_notes' => 'nullable|string|max:5000',
        ]);

        $report->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? $report->admin_notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Report updated successfully.',
            'data' => $report->fresh(),
        ]);
    }
}
