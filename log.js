'use strict';

// log level
const LOGLV_NONE = 9;
const LOGLV_DEBUG = 1;
const LOGLV_INFO = 2;
const LOGLV_WARN = 3;
const LOGLV_ERROR = 4;

class logEx {
    constructor(log, log_level = LOGLV_INFO) {
        this.log = (level, content) => {
            if (level < log_level || log_level === LOGLV_NONE)
                return;

            switch (level) {
                case LOGLV_DEBUG:
                    log('[DEBUG] ' + content);
                    break;
                case LOGLV_INFO:
                    log('[INFO] ' + content);
                    break;
                case LOGLV_WARN:
                    log.warn('[WARN] ' + content);
                    break;
                case LOGLV_ERROR:
                default:
                    log.error('[ERROR] ' + content);
                    break;
            }
        };
    }
}
module.exports = { logEx, LOGLV_NONE, LOGLV_DEBUG, LOGLV_INFO, LOGLV_WARN, LOGLV_ERROR }
