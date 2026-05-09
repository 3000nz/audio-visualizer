<?php
/**
 * Plugin Name:  Audio Visualizer
 * Plugin URI:   https://github.com/3000nz/audio-visualizer
 * Description:  Full-screen WebGL audio visualizer — microphone or system audio, 5 trippy modes, neon bloom.
 * Version:      1.0.0
 * Requires PHP: 7.4
 * License:      MIT
 */

if (!defined('ABSPATH')) exit;

define('AUDIO_VIZ_VERSION', '1.0.0');
define('AUDIO_VIZ_URL',     plugin_dir_url(__FILE__));
define('AUDIO_VIZ_PATH',    plugin_dir_path(__FILE__));

/**
 * Register "Audio Visualizer" as a selectable page template.
 */
add_filter('theme_page_templates', function (array $templates): array {
    $templates['audio-visualizer-page'] = __('Audio Visualizer (Full Screen)', 'audio-visualizer');
    return $templates;
});

/**
 * Intercept template loading: when our template is selected, serve our own file.
 */
add_filter('template_include', function (string $template): string {
    if (!is_page()) return $template;

    $slug = get_post_meta(get_the_ID(), '_wp_page_template', true);
    if ($slug === 'audio-visualizer-page') {
        return AUDIO_VIZ_PATH . 'templates/audio-visualizer-page.php';
    }

    return $template;
});
