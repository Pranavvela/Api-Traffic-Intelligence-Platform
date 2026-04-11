'use strict';

const VALID_MODES = new Set(['normal', 'attack', 'mixed']);

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

module.exports = { runSimulator };
