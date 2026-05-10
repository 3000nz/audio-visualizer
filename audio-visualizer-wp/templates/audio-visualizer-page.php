<?php
/**
 * Full-screen Audio Visualizer page template.
 * Outputs a complete standalone HTML document, bypassing the active theme entirely.
 */
if (!defined('ABSPATH')) exit;

// Clean any output WordPress may have buffered before we took over.
while (ob_get_level()) ob_end_clean();

$asset_url = AUDIO_VIZ_URL . 'assets/';
$page_title = get_the_title() ?: get_bloginfo('name');
?>
<!DOCTYPE html>
<html lang="<?php echo esc_attr(get_bloginfo('language')); ?>">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?php echo esc_html($page_title); ?></title>
  <link rel="stylesheet" href="<?php echo esc_url($asset_url . 'visualizer.css'); ?>" />
</head>
<body>

  <canvas id="canvas"></canvas>
  <canvas id="canvas-2d"></canvas>

  <!-- ── Start overlay ──────────────────────────────────────────── -->
  <div id="overlay">
    <div class="overlay-inner">
      <h1>AUDIO VISUALIZER</h1>
      <p class="subtitle">Choose your audio source to begin</p>
      <div class="source-buttons">
        <button id="btn-mic" class="source-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="2" width="6" height="11" rx="3"/>
            <path d="M5 10a7 7 0 0 0 14 0"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
          <span>Microphone</span>
        </button>
        <button id="btn-system" class="source-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>System Audio</span>
          <small>Share screen + audio</small>
        </button>
      </div>
      <p class="hint">Press <kbd>H</kbd> to toggle controls &nbsp;·&nbsp; <kbd>M</kbd> to cycle modes</p>
    </div>
  </div>

  <!-- ── Settings panel ─────────────────────────────────────────── -->
  <div id="panel">
    <div class="panel-section">
      <label class="section-label">MODE</label>
      <div class="mode-row">
        <button id="prev-mode" class="icon-btn">&#8249;</button>
        <span id="mode-name">Radial Bars</span>
        <button id="next-mode" class="icon-btn">&#8250;</button>
      </div>
    </div>

    <div class="panel-section">
      <label class="section-label">SOURCE</label>
      <div class="toggle-row">
        <button id="src-mic" class="toggle-btn active">Mic</button>
        <button id="src-system" class="toggle-btn">System</button>
      </div>
    </div>

    <div class="panel-section">
      <label class="section-label">PALETTE</label>
      <div class="palette-row">
        <button class="palette-btn active" data-palette="0" title="Neon">
          <span class="swatch neon"></span>Neon
        </button>
        <button class="palette-btn" data-palette="1" title="Fire">
          <span class="swatch fire"></span>Fire
        </button>
        <button class="palette-btn" data-palette="2" title="Space">
          <span class="swatch space"></span>Space
        </button>
        <button class="palette-btn" data-palette="3" title="Mono">
          <span class="swatch mono"></span>Mono
        </button>
      </div>
    </div>

    <div class="panel-section sliders">
      <div class="slider-row">
        <label>Sensitivity</label>
        <input type="range" id="sl-sensitivity" min="0.5" max="3" step="0.05" value="1.5" />
        <span class="sl-val" id="val-sensitivity">1.5×</span>
      </div>
      <div class="slider-row">
        <label>Bloom</label>
        <input type="range" id="sl-bloom" min="0" max="3" step="0.05" value="1.5" />
        <span class="sl-val" id="val-bloom">1.5</span>
      </div>
      <div class="slider-row">
        <label>Speed</label>
        <input type="range" id="sl-speed" min="0.1" max="3" step="0.05" value="1.0" />
        <span class="sl-val" id="val-speed">1.0×</span>
      </div>
      <div class="slider-row">
        <label>Intensity</label>
        <input type="range" id="sl-intensity" min="0.2" max="3" step="0.05" value="1.0" />
        <span class="sl-val" id="val-intensity">1.0×</span>
      </div>
    </div>

    <div class="panel-footer">
      <span class="hint-text"><kbd>H</kbd> hide &nbsp; <kbd>M</kbd> mode</span>
    </div>
  </div>

  <!-- ── Toggle button (always visible) ────────────────────────── -->
  <button id="toggle-panel" title="Toggle controls (H)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  </button>

  <script type="module" src="<?php echo esc_url($asset_url . 'visualizer.js'); ?>"></script>
</body>
</html>
<?php exit; ?>
