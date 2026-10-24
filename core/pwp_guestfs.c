#include "pwp_guestfs.h"

#ifdef __wasm__
__attribute__((import_module("pwp"), import_name("read_file")))
#endif
extern int32_t pwp_host_read(uint64_t offset, void *destination, uint32_t count);

static uint64_t file_size = 0;
static uint64_t position = 0;
static int32_t mounted = 0;

int32_t pwp_mount(uint64_t size) {
    if (size == 0) {
        pwp_unmount();
        return 0;
    }
    file_size = size;
    position = 0;
    mounted = 1;
    return 1;
}

void pwp_unmount(void) {
    mounted = 0;
    file_size = 0;
    position = 0;
}

int32_t pwp_is_mounted(void) { return mounted; }
int32_t pwp_seek(uint64_t offset) {
    if (!mounted) return 0;
    position = offset; /* DOS seek beyond EOF is permitted. */
    return 1;
}

int32_t pwp_read(void *dest, uint32_t count) {
    if (!mounted || !dest || count > PWP_FS_MAX_READ) return -1;
    if (count == 0 || position >= file_size) return 0;
    uint64_t left = file_size - position;
    if (left < count) count = (uint32_t)left;
    /* Reads are transactional w.r.t. seek position: failure doesn't advance. */
    int32_t actual = pwp_host_read(position, dest, count);
    if (actual < 0 || (uint32_t)actual > count) return -1;
    position += (uint32_t)actual;
    return actual;
}
uint64_t pwp_size(void) { return mounted ? file_size : 0; }
uint64_t pwp_tell(void) { return mounted ? position : 0; }
