import type { EvidenceTools } from './index.js';
import type { Evidence, PolicyClause, Dispute } from '@fairtrip/contracts';

// Mock evidence provider with labeled synthetic data for all 4 evidence families.
// Used for deterministic tests when partner adapters are unavailable.
// All data is clearly labeled as contract examples / synthetic fixtures.

const mockEvidenceStore: Record<string, Evidence[]> = {
  'dispute-route-example': [
    {
      id: 'e-route-gps-1',
      source: 'gps',
      timestamp: '2026-10-08T08:30:00Z',
      facts: {
        actualRoute: [{lat: 1.3521, lng: 103.8198}, {lat: 1.3600, lng: 103.8200}, {lat: 1.3700, lng: 103.8300}],
        referenceRoute: [{lat: 1.3521, lng: 103.8198}, {lat: 1.3550, lng: 103.8250}, {lat: 1.3700, lng: 103.8300}],
        actualDistanceMeters: 3200,
        referenceDistanceMeters: 2800,
        pickupProximityMeters: 45,
        waitingSeconds: 180
      },
      provenance: {kind: 'contract_example', description: 'Synthetic GPS data for route deviation test case'}
    },
    {
      id: 'e-route-chat-1',
      source: 'chat',
      timestamp: '2026-10-08T08:25:00Z',
      facts: {
        messages: [
          {sender: 'rider', text: 'I am at the pickup point', time: '08:25:00'},
          {sender: 'driver', text: 'I see you, coming now', time: '08:26:00'}
        ]
      },
      provenance: {kind: 'contract_example', description: 'Synthetic chat log for route deviation test case'}
    },
    {
      id: 'e-route-payment-1',
      source: 'payment',
      timestamp: '2026-10-08T08:45:00Z',
      facts: {
        baseFareCents: 350,
        distanceChargeCents: 420,
        surgeMultiplier: 1.0,
        promotionDeductionCents: 0,
        cancellationFeeCents: 0,
        totalPaidCents: 770,
        currency: 'SGD'
      },
      provenance: {kind: 'contract_example', description: 'Synthetic payment record for route deviation test case'}
    },
    {
      id: 'e-route-history-1',
      source: 'history',
      timestamp: '2026-10-08T08:00:00Z',
      facts: {
        riderDisputeCount: 1,
        riderRating: 4.5,
        riderAccountAgeMonths: 18,
        driverDisputeCount: 0,
        driverRating: 4.8,
        driverAccountAgeMonths: 24
      },
      provenance: {kind: 'contract_example', description: 'Synthetic historical profile for route deviation test case'}
    }
  ],
  'dispute-no-show-example': [
    {
      id: 'e-noshow-gps-1',
      source: 'gps',
      timestamp: '2026-10-08T09:00:00Z',
      facts: {
        actualRoute: [{lat: 1.3000, lng: 103.8000}],
        pickupProximityMeters: 120,
        waitingSeconds: 360,
        driverArrivedAt: '09:00:00',
        cancellationAt: '09:06:00'
      },
      provenance: {kind: 'contract_example', description: 'Synthetic GPS data for no-show test case'}
    },
    {
      id: 'e-noshow-chat-1',
      source: 'chat',
      timestamp: '2026-10-08T08:58:00Z',
      facts: {
        messages: [
          {sender: 'driver', text: 'I have arrived', time: '09:00:00'},
          {sender: 'rider', text: 'Be there in 2 minutes', time: '09:01:00'},
          {sender: 'driver', text: 'Waiting at pickup', time: '09:03:00'}
        ]
      },
      provenance: {kind: 'contract_example', description: 'Synthetic chat log for no-show test case'}
    },
    {
      id: 'e-noshow-payment-1',
      source: 'payment',
      timestamp: '2026-10-08T09:06:00Z',
      facts: {
        baseFareCents: 0,
        distanceChargeCents: 0,
        surgeMultiplier: 1.0,
        promotionDeductionCents: 0,
        cancellationFeeCents: 500,
        totalPaidCents: 500,
        currency: 'SGD'
      },
      provenance: {kind: 'contract_example', description: 'Synthetic payment record for no-show test case'}
    },
    {
      id: 'e-noshow-history-1',
      source: 'history',
      timestamp: '2026-10-08T08:00:00Z',
      facts: {
        riderDisputeCount: 0,
        riderRating: 4.7,
        riderAccountAgeMonths: 12,
        driverDisputeCount: 1,
        driverRating: 4.6,
        driverAccountAgeMonths: 36
      },
      provenance: {kind: 'contract_example', description: 'Synthetic historical profile for no-show test case'}
    }
  ]
};

const mockPolicyStore: Record<string, PolicyClause[]> = {
  route_deviation: [
    {
      id: 'p-route-deviation-1',
      version: 'demo-0.1.0',
      category: 'route_deviation',
      ruleText: 'A material detour exists when the excess distance exceeds the greater of 500 metres or 10% of the reference distance. If the detour is unjustified and without rider consent, refund the eligible excess-distance charge.',
      remedyCriteria: 'refund_route_excess when unjustified detour is proven; keep_charge when rider consented or legitimate diversion is documented'
    }
  ],
  no_show: [
    {
      id: 'p-no-show-1',
      version: 'demo-0.1.0',
      category: 'no_show',
      ruleText: 'Retain the no-show charge when the driver was within 150 metres of pickup, waited at least 300 seconds, and made a recorded contact attempt before cancellation. Otherwise refund the paid no-show fee.',
      remedyCriteria: 'keep_charge when arrival, wait, and contact are all proven; refund_no_show_fee when any requirement is not met'
    }
  ]
};

export function createMockEvidenceTools(dispute: Dispute): EvidenceTools {
  return {
    async getEvidence(input: {sources: Evidence['source'][]}): Promise<Evidence[]> {
      const allEvidence = mockEvidenceStore[dispute.id] ?? mockEvidenceStore['dispute-route-example'];
      if (!allEvidence) return [];
      return allEvidence.filter(e => input.sources.includes(e.source));
    },
    async getPolicy(input: {category: Dispute['category']}): Promise<PolicyClause[]> {
      return mockPolicyStore[input.category] ?? [];
    }
  };
}

// Export the raw data for test assertions
export { mockEvidenceStore, mockPolicyStore };
