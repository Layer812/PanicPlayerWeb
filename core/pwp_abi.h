#ifndef PWP_ABI_H
#define PWP_ABI_H
/* PANIC PLAYER WEB core-to-host boundary, DRAFT v0.1 — not a working emulator.
 * This native C header declares only responsibilities; no fake decoder is supplied.
 * A real implementation must preserve panic.x V1.38 guest semantics and timing.
 */
#include <stdint.h>
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
#define PWP_ABI_VERSION 1
/* Outputs are guest-initiated. All callbacks are invoked on the owning worker.
 * File reads must be served from a staged cache or a worker-compatible async
 * interop layer; browser File.slice() is asynchronous, so it must NOT be called
 * synchronously from arbitrary WASM exports.
 */
typedef struct PwpHost {
  void *user;
  void (*video_rgba)(void *user, const uint8_t *pixels, uint32_t width, uint32_t height);
  void (*audio_pcm_f32)(void *user, const float *interleaved, uint32_t frames, uint32_t rate, uint32_t channels);
  void (*finished)(void *user, int32_t guest_code);
  void (*fault)(void *user, const char *reason);
} PwpHost;
typedef struct PwpCore PwpCore;
/* Proposed native public API. Not implemented in R1. */
PwpCore *pwp_create(const PwpHost *host);
int pwp_load_file(PwpCore *core, const char *virtual_path);
int pwp_start(PwpCore *core);
void pwp_guest_space(PwpCore *core);
void pwp_stop(PwpCore *core);
void pwp_destroy(PwpCore *core);
#ifdef __cplusplus
}
#endif
#endif
