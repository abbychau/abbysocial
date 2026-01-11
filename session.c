/* snac - A simple, minimalistic ActivityPub instance */
/* copyright (c) 2022 - 2026 grunfink et al. / MIT license */

#include "xs.h"
#include "xs_hex.h"
#include "xs_random.h"
#include "xs_time.h"

#include "snac.h"

#include <pthread.h>

static session_entry *sessions = NULL;
static pthread_mutex_t session_mutex = PTHREAD_MUTEX_INITIALIZER;

#define SESSION_CLEANUP_INTERVAL 3600  /* 1 hour */

void session_init(void)
/* initialize session management */
{
    sessions = NULL;
}


char *session_create(const char *uid)
/* create a new session and return session ID */
{
    if (uid == NULL || *uid == '\0')
        return NULL;

    /* generate a random session ID */
    unsigned char random_bytes[32];
    xs_rnd_buf(random_bytes, sizeof(random_bytes));
    xs *session_id_hex = xs_hex_enc((char *)random_bytes, sizeof(random_bytes));
    
    session_entry *new_session = malloc(sizeof(session_entry));
    if (new_session == NULL)
        return NULL;
    
    strncpy(new_session->session_id, session_id_hex, sizeof(new_session->session_id) - 1);
    new_session->session_id[sizeof(new_session->session_id) - 1] = '\0';
    
    strncpy(new_session->uid, uid, sizeof(new_session->uid) - 1);
    new_session->uid[sizeof(new_session->uid) - 1] = '\0';
    
    new_session->created = time(NULL);
    new_session->last_access = new_session->created;
    
    pthread_mutex_lock(&session_mutex);
    new_session->next = sessions;
    sessions = new_session;
    pthread_mutex_unlock(&session_mutex);
    
    srv_debug(1, xs_fmt("session_create: created session for user %s", uid));
    
    return strdup(new_session->session_id);
}


const char *session_validate(const char *session_id)
/* validate session and return uid if valid, NULL otherwise */
{
    if (session_id == NULL || *session_id == '\0')
        return NULL;
    
    pthread_mutex_lock(&session_mutex);
    
    session_entry *current = sessions;
    time_t now = time(NULL);
    
    while (current != NULL) {
        if (strcmp(current->session_id, session_id) == 0) {
            /* check if session has expired */
            if (now - current->last_access > SESSION_TIMEOUT) {
                pthread_mutex_unlock(&session_mutex);
                session_destroy(session_id);
                return NULL;
            }
            
            /* update last access time */
            current->last_access = now;
            pthread_mutex_unlock(&session_mutex);
            
            return current->uid;
        }
        current = current->next;
    }
    
    pthread_mutex_unlock(&session_mutex);
    return NULL;
}


void session_destroy(const char *session_id)
/* destroy a session */
{
    if (session_id == NULL || *session_id == '\0')
        return;
    
    pthread_mutex_lock(&session_mutex);
    
    session_entry *current = sessions;
    session_entry *prev = NULL;
    
    while (current != NULL) {
        if (strcmp(current->session_id, session_id) == 0) {
            if (prev == NULL) {
                sessions = current->next;
            } else {
                prev->next = current->next;
            }
            
            srv_debug(1, xs_fmt("session_destroy: destroyed session for user %s", current->uid));
            free(current);
            pthread_mutex_unlock(&session_mutex);
            return;
        }
        prev = current;
        current = current->next;
    }
    
    pthread_mutex_unlock(&session_mutex);
}


void session_cleanup(void)
/* cleanup expired sessions */
{
    pthread_mutex_lock(&session_mutex);
    
    session_entry *current = sessions;
    session_entry *prev = NULL;
    time_t now = time(NULL);
    int cleaned = 0;
    
    while (current != NULL) {
        session_entry *next = current->next;
        
        if (now - current->last_access > SESSION_TIMEOUT) {
            if (prev == NULL) {
                sessions = next;
            } else {
                prev->next = next;
            }
            
            free(current);
            cleaned++;
        } else {
            prev = current;
        }
        
        current = next;
    }
    
    pthread_mutex_unlock(&session_mutex);
    
    if (cleaned > 0)
        srv_debug(1, xs_fmt("session_cleanup: cleaned %d expired sessions", cleaned));
}
