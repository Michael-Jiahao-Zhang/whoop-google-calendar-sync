# Personal installation privacy notice template

Adapt this notice with your own operator/contact information before using it for a WHOOP developer application. This repository does not host an OAuth application or collect users' health data.

The installed script reads WHOOP sleep and workout records with `read:sleep`, `read:workout`, and offline token refresh. It writes recorded start/end times, activity labels, source identifiers, and available sleep/workout metrics to the Google Calendar chosen by the installer. It does not request profile, recovery, or body-measurement scopes.

Client credentials are stored in Apps Script Script Properties. OAuth tokens and synchronization state are stored in Apps Script User Properties, with tokens temporarily cached in the user's Apps Script cache. Synchronization logs contain counts and operational errors, not health measurements. The one-time OAuth authorization link can appear in the setup log and must not be shared.

Health records remain subject to WHOOP's and Google's processing and retention policies. Calendar visibility controls who can read the written health details. Apps Script project editors may access its credentials, code, and stored state. Keep the project private and review calendar sharing.

The installer can stop triggers with `disableSync`, revoke WHOOP/Google authorization, remove stored credentials, and delete written events through Google Calendar. Disabling a trigger does not delete events or revoke authorization automatically.

This is a personal automation, not medical advice or a hosted service. For privacy questions, contact the operator of your own installed application.
