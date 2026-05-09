'use strict';

const VALID_MODES = new Set(['normal', 'attack', 'mixed']);
const VALID_EVASION_TYPES = new Set(['slow_and_low', 'distributed', 'burst_hide']);

/**
 * POST /api/simulator/run
 * Body: { mode: 'normal' | 'attack' | 'mixed', attackType?: string }
 * This endpoint is a placeholder for future orchestration. It does not
 * execute the simulator locally.
 */
async function runSimulator(req, res, next) {
  try {
    const { mode, attackType } = req.body || {};
    const normalized = String(mode || '').toLowerCase();

    if (!VALID_MODES.has(normalized)) {
      return res.status(400).json({
        success: false,
        message: 'mode must be one of: normal, attack, mixed.',
      });
    }

    return res.status(202).json({
      success: true,
      message: 'Simulator run accepted. Execute in external client.',
      data: { mode: normalized, attackType: attackType || null },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/simulator/test-evasion
 * Body: { evasionType: 'slow_and_low' | 'distributed' | 'burst_hide', durationMs?: number }
 * Test adversarial robustness of detection system
 * Paper: "Adversarial Attacks Against Anomaly Detectors"
 */
async function testEvasion(req, res, next) {
  try {
    const { evasionType, durationMs, config } = req.body || {};
    const normalized = String(evasionType || '').toLowerCase();

    if (!VALID_EVASION_TYPES.has(normalized)) {
      return res.status(400).json({
        success: false,
        message: `evasionType must be one of: ${Array.from(VALID_EVASION_TYPES).join(', ')}`,
        code: 'INVALID_EVASION_TYPE',
      });
    }

    const testConfig = {
      ...config,
      durationMs: durationMs || 60000,
    };

    return res.status(202).json({
      success: true,
      message: 'Adversarial evasion test queued. Execute evasion simulator with this config.',
      data: {
        evasionType: normalized,
        config: testConfig,
      },
      documentation: {
        slow_and_low: 'Spreads requests over long windows to evade rate-limit rules',
        distributed: 'Distributes attacks across multiple IPs to evade blocklists',
        burst_hide: 'Mixes attacks with normal traffic to hide burst patterns',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/simulator/evasion-guide
 * Return documentation on evasion attacks and detection strategies
 */
function getEvasionGuide(req, res) {
  return res.json({
    success: true,
    data: {
      title: 'Adversarial Evasion Attack Guide',
      paper_reference: 'Adversarial Attacks Against ML-based Anomaly Detectors (2020+)',
      evasion_types: {
        slow_and_low: {
          description: 'Gradual brute-force with long intervals to stay under rate-limit thresholds',
          evasion_strategy: 'Keep request rate low and spread over wide time windows',
          detection_difficulty: 'Easy to detect with temporal analysis',
          example_config: {
            durationMs: 120000,
            requestsPerMinute: 5,
          },
        },
        distributed: {
          description: 'Same action from multiple IPs to evade IP-based blocklists',
          evasion_strategy: 'Distribute from many sources to avoid single-IP blocklisting',
          detection_difficulty: 'Moderate - requires cross-IP correlation',
          example_config: {
            durationMs: 60000,
            numIPs: 10,
            requestsPerIP: 3,
          },
        },
        burst_hide: {
          description: 'Mix attacks with normal traffic to hide burst patterns',
          evasion_strategy: 'Hide spikes in normal traffic baseline',
          detection_difficulty: 'Hard - requires behavioral learning to distinguish',
          example_config: {
            durationMs: 60000,
            burstSize: 20,
            normalTrafficPercentage: 70,
          },
        },
      },
      recommended_detections: [
        'Ensemble methods (Z-Score + Isolation Forest)',
        'Concept drift detection to adapt to new attack patterns',
        'Behavioral learning with long baseline windows',
        'Multi-dimensional anomaly scoring',
      ],
    },
  });
}

module.exports = { runSimulator, testEvasion, getEvasionGuide };
