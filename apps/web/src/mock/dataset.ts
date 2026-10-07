// DEV MOCK only: the real SYNTHETIC fixtures and DEMONSTRATION POLICY from @fairtrip/evidence.
import { parseDataset, type Dataset } from "@fairtrip/evidence";
import policy from "@fairtrip/evidence/data/policy/demo-policy.v1.json";
import N1 from "@fairtrip/evidence/data/fixtures/N1.json";
import N2 from "@fairtrip/evidence/data/fixtures/N2.json";
import N2H from "@fairtrip/evidence/data/fixtures/N2H.json";
import N3 from "@fairtrip/evidence/data/fixtures/N3.json";
import NE from "@fairtrip/evidence/data/fixtures/NE.json";
import R1 from "@fairtrip/evidence/data/fixtures/R1.json";
import R1S from "@fairtrip/evidence/data/fixtures/R1S.json";
import R2 from "@fairtrip/evidence/data/fixtures/R2.json";
import R3 from "@fairtrip/evidence/data/fixtures/R3.json";
import X1 from "@fairtrip/evidence/data/fixtures/X1.json";
import X2 from "@fairtrip/evidence/data/fixtures/X2.json";
import X3 from "@fairtrip/evidence/data/fixtures/X3.json";
import expected from "@fairtrip/evidence/data/expected-outcomes.json";

let cached: Dataset | undefined;
export function mockDataset(): Dataset {
  cached ??= parseDataset({ policy, fixtures: [R1, R2, R3, N1, N2, N3, R1S, NE, N2H, X1, X2, X3], expectedOutcomes: expected });
  return cached;
}
