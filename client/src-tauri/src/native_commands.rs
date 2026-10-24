// Shared by runtime registration and build-time permission generation.
macro_rules! with_native_commands {
    ($callback:ident) => {
        $callback![
            // System commands
            greet,
            get_video_server_port,
            test_download_command,
            get_active_downloads_count,
            set_clip_generation_in_progress,
            is_clip_generation_in_progress,
            set_unsaved_changes,
            confirm_app_close,

            // Download management commands
            cancel_all_downloads,
            cancel_download,
            cleanup_completed_download,

            // File operations commands
            check_file_exists,
            validate_video_file,
            generate_proxy_file,

            // File utility commands
            commands::file_utils::get_file_info,
            commands::file_utils::get_media_metadata,
            commands::file_utils::generate_video_thumbnail,
            commands::reference_video::cancel_reference_analysis,
            commands::video_measure::import_reference_video,
            commands::video_measure::measure_video,
            commands::ai_media::inspect_ai_media,
            commands::ai_media::encode_image_for_ai,

            // Auth commands
            auth::open_wallet_auth_window,
            auth::poll_auth_result,
            auth::clear_auth_result,
            auth::open_wallet_payment_window,
            auth::poll_payment_result,
            auth::clear_payment_result,
            auth::open_google_auth_window,
            auth::open_google_auth_url,
            auth::poll_google_auth_result,
            auth::clear_google_auth_result,
            auth::start_email_verification_listener,
            auth::poll_email_verification_result,
            auth::clear_email_verification_result,
            stripe_callback::open_stripe_payment_window,
            stripe_callback::poll_stripe_payment_result,
            stripe_callback::clear_stripe_payment_result,
            auth::start_social_oauth,

            // PumpFun commands
            pumpfun::get_pumpfun_clips,
            pumpfun::check_pumpfun_livestream,
            pumpfun::join_pumpfun_livestream,
            pumpfun::get_livekit_regions,
            pumpfun::start_livestream_recording,
            pumpfun::stop_livestream_recording,
            pumpfun::stop_all_livestream_recordings,

            // Kick commands
            kick::check_kick_livestream,
            kick::get_kick_stream_url,
            kick::check_ytdlp_available,
            kick::get_ytdlp_version,
            kick::start_kick_recording,
            kick::stop_kick_recording,
            kick::stop_kick_recording_session,
            kick::stop_all_kick_recordings,
            kick::get_kick_session_output_dir,
            kick::get_active_kick_recordings,
            kick::is_kick_recording_active,

            // Twitch commands
            twitch::check_twitch_livestream,
            twitch::get_twitch_vods,
            twitch::start_twitch_recording,
            twitch::stop_twitch_recording,
            twitch::stop_twitch_recording_session,
            twitch::stop_all_twitch_recordings,
            twitch::get_twitch_session_output_dir,
            twitch::get_active_twitch_recordings,

            // YouTube commands
            youtube::check_youtube_livestream,
            youtube::get_youtube_channel_info,
            youtube::get_youtube_vods,
            youtube::get_youtube_videos,
            youtube::get_single_youtube_video,
            youtube::fetch_youtube_captions,
            youtube::download_youtube_audio_for_transcription,
            youtube::get_youtube_vod_duration,
            youtube::download_youtube_vod,
            youtube::download_youtube_vod_segment,
            youtube::start_youtube_recording,
            youtube::stop_youtube_recording,
            youtube::stop_youtube_recording_session,
            youtube::stop_all_youtube_recordings,
            youtube::get_youtube_session_output_dir,
            youtube::get_active_youtube_recordings,
            youtube::is_youtube_recording_active,

            // Rumble commands
            rumble::check_rumble_livestream,
            rumble::get_rumble_channel_info,
            rumble::get_rumble_vods,
            rumble::get_rumble_videos,
            rumble::get_single_rumble_video,
            rumble::get_rumble_vod_duration,
            rumble::download_rumble_vod,
            rumble::download_rumble_vod_segment,
            rumble::start_rumble_recording,
            rumble::stop_rumble_recording,
            rumble::stop_rumble_recording_session,
            rumble::stop_all_rumble_recordings,
            rumble::get_rumble_session_output_dir,
            rumble::get_active_rumble_recordings,
            rumble::is_rumble_recording_active,

            // Twitter commands
            twitter::validate_twitter_url,
            twitter::get_twitter_broadcast_info,
            twitter::get_twitter_broadcast_duration,
            twitter::resolve_twitter_user_by_rest_id,
            twitter::download_twitter_thumbnail,
            twitter::download_twitter_vod,
            twitter::download_twitter_vod_segment,
            twitter::start_twitter_recording,
            twitter::stop_twitter_recording,
            twitter::stop_twitter_recording_session,
            twitter::stop_all_twitter_recordings,
            twitter::get_twitter_session_output_dir,
            twitter::get_active_twitter_recordings,
            twitter::is_twitter_recording_active,

            // Download commands
            downloads::download_pumpfun_vod,
            downloads::download_pumpfun_vod_segment,
            downloads::download_kick_vod,
            downloads::download_kick_vod_segment,
            downloads::probe_kick_vod_duration,
            twitch::download_twitch_vod,
            twitch::download_twitch_vod_segment,

            // Audio commands
            audio::extract_audio_from_video,
            audio::extract_audio_from_segments,
            video_chunk_extraction::extract_video_chunk_for_analysis,
            audio::extract_and_chunk_audio,
            audio::cancel_audio_extraction,
            audio::extract_audio_to_file,
            audio::extract_audio_to_file_wav,
            audio::get_audio_duration,
            download_library_audio,
            download_broll_media,
            resolve_broll_media_path,

            // Audio download commands
            audio_download::download_youtube_audio,
            audio_download::upload_audio_file,
            audio_download::generate_audio_thumbnail,
            audio_download::cancel_audio_download,

            // Waveform commands
            waveform::extract_audio_waveform,
            waveform::get_cached_waveform,
            waveform::save_waveform_to_cache,
            waveform::clear_waveform_cache,
            waveform::extract_audio_peaks_for_range,
            waveform::probe_video_duration,

            // Audio peaks detection commands
            audio_peaks::detect_audio_peaks,

            // Storage commands
            storage::get_storage_paths,
            storage::get_app_data_dir,
            storage::create_directory,
            storage::delete_editor_project_media,
            storage::copy_video_to_storage,
            storage::copy_asset_to_storage,
            storage::copy_clip_to_destination,
            storage::delete_asset_file,
            storage::generate_thumbnail,
            storage::generate_thumbnail_at_timestamp,
            storage::save_temp_file,
            storage::save_editor_media_file,
            storage::get_editor_clip_extract_path,
            storage::copy_file_to_project_media,
            storage::read_file_as_data_url,
            storage::delete_video_file,
            storage::delete_raw_video_files,
            storage::delete_proxy_files,
            storage::delete_livestream_recording,
            storage::cleanup_watch_livestream_recordings,
            storage::get_video_duration,
            storage::get_video_metadata,
            storage::get_audio_metadata,
            storage::get_image_metadata,
            storage::copy_watermark_to_storage,
            storage::copy_creator_reference_frame_to_storage,
            storage::delete_watermark_file,
            storage::copy_font_to_storage,
            storage::delete_font_file,
            storage::copy_audio_to_storage,
            storage::delete_audio_file,
            storage::copy_image_to_storage,
            storage::delete_image_file,
            storage::save_org_asset_file,
            storage::download_org_asset_from_url,
            // User context for per-user storage
            storage::set_current_user_id,
            storage::clear_current_user_id,

            // Delete local storage commands
            calculate_local_storage_size,
            delete_local_storage,

            // Assets commands
            assets::upload_asset_async,

            // Clips commands
            clips::build_clip_from_segments,
            clips::build_editor_export_variants,
            clips::cancel_clip_build,
            clips::is_clip_build_active,
            clips::save_subtitle_overlay_png,
            clips::livestream_clip::extract_livestream_clip,
            clips::livestream_clip::cancel_livestream_clip_extraction,
            clips::video_processor::generate_segment_preview,
            clips::video_processor::delete_segment_preview,
            clips::video_processor::generate_preview_chunk,
            clips::video_processor::write_preview_manifest,
            clips::video_processor::delete_preview_cache,
            clips::video_processor::get_preview_cache_path,

            // Focal detection commands
            detect_focal_points,

            // Video conversion commands
            convert_video_to_mp4,
            download_url_as_data_url,

            // UI Utils commands
            ui_utils::setup_macos_titlebar,
            ui_utils::get_platform,
            ui_utils::save_window_size,
            ui_utils::load_window_size,

            // File operations
            copy_file,
            read_video_file,
            save_temp_media_file,

            // PIP control window commands
            create_pip_control_window,
            close_pip_control_window,

            // DVR commands
            dvr::save_dvr_chunk,
            dvr::get_dvr_chunk_path,
            dvr::cleanup_dvr_chunks,
            dvr::list_dvr_chunks,
            dvr::get_dvr_directory,
            dvr::has_dvr_chunks,
            dvr::read_all_dvr_chunks,
            dvr::read_dvr_chunk,
            dvr::read_dvr_init_segment,
            dvr::read_dvr_cluster,
            dvr::build_vod_from_dvr,
            dvr::build_segment_from_dvr_chunks,

            // HLS commands
            hls::start_hls_recording,
            hls::stop_hls_recording,
            hls::cleanup_hls_recordings,
            hls::get_recording_output_dir,
            hls::get_hls_segments,
            hls::create_vod_playlist,
            hls::delete_vod_playlist,

            // Video Editor Export commands
            video_editor_export::export_video_editor_project_simple,
            video_editor_export::export_video_editor_project,
            video_editor_export::cancel_video_editor_export,
            video_editor_export::save_text_overlay_png,
            video_editor_export::save_overlay_frame_sequence,
            video_editor_export::write_scene_export_frame_batch,
            video_editor_export::finalize_scene_export_frames,

            // Video Frame Decoder commands
            video::get_video_frame,
            video::get_video_frame_with_dimensions,
            video::prefetch_video_frames,
            video::clear_video_decoder,
            video::clear_all_video_decoders,
            video::clear_frame_cache,
            video::get_frame_cache_stats,
            video::get_decoder_info,

            // Clip Extractor commands
            clip_extractor_commands::extract_clip,
            clip_extractor_commands::generate_clip_thumbnail,
            clip_extractor_commands::generate_waveform,
            clip_extractor_commands::delete_file,
            clip_extractor_commands::file_exists,

            // Font commands
            font_commands::read_font_file,
            font_commands::read_bundled_font,
            font_commands::copy_font_to_app_data,
            font_commands::list_custom_fonts,
            font_commands::resolve_font_path,

            // HLS Proxy commands
            hls_proxy::read_hls_playlist,
            hls_proxy::read_hls_segment,
            hls_proxy::check_hls_playlist_exists,

            // Avatar proxy command
            avatar_proxy::fetch_avatar_image,

            // Hyperframes (AI video) sidecar commands
            commands::hyperframes::hyperframes_request,
            commands::hyperframes::hyperframes_workspace_dir,
            commands::hyperframes::hyperframes_stop,

            // Studio recording commands
            studio::studio_list_devices,
            studio::studio_start_recording,
            studio::studio_stop_recording,
            studio::studio_get_recording_status,
            studio::studio_finalize_recording,
            studio::studio_save_recording,

        ]
    };
}
