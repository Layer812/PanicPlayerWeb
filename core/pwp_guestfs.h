#ifndef PWP_GUESTFS_H
#define PWP_GUESTFS_H
/* Panic Player Web R2: bounded, read-only, synchronous file access for guest.
 * Pure C, host-agnostic. Not a PAN decoder or a runnable 68000/PANIC engine.
 * The host read callback must be synchronous and must never block UI thread.
 */
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define PWP_FS_MAX_READ (2u * 1024u * 1024u)
int32_t pwp_mount(uint64_t size);
void pwp_unmount(void);
int32_t pwp_is_mounted(void);
int32_t pwp_seek(uint64_t offset);
int32_t pwp_read(void *dest, uint32_t count);
uint64_t pwp_size(void);
uint64_t pwp_tell(void);
/* Import supplied by worker host (not from UI/main thread):
 * int32_t read_file(uint64_t offset, void *wasm_dest, uint32_t len)
 * A return of -1 means failure. 0 is EOF. Success is 0 .. len.
 */
#ifdef __cplusplus
}
#endif
#endif
