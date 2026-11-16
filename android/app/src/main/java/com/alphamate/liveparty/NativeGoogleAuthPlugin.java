package com.alphamate.liveparty;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Built-in Android Google Sign-In Capacitor plugin compiled directly inside :app.
 * Uses AndroidX Credential Manager with automatic fallback to GoogleSignInClient.
 */
@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {

    private final Executor executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = resolveServerClientId(call.getString("serverClientId"));
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("Missing Google OAuth Web Client ID configuration.", "MISSING_CLIENT_ID");
            return;
        }

        boolean forceAccountPicker = !Boolean.FALSE.equals(call.getBoolean("forceAccountPicker", true));
        boolean useCredentialManager = !Boolean.FALSE.equals(call.getBoolean("useCredentialManager", true));

        if (useCredentialManager) {
            if (forceAccountPicker) {
                try {
                    CredentialManager credentialManager = CredentialManager.create(getActivity());
                    credentialManager.clearCredentialStateAsync(
                        new ClearCredentialStateRequest(),
                        null,
                        executor,
                        new CredentialManagerCallback<Void, ClearCredentialException>() {
                            @Override
                            public void onResult(Void result) {
                                launchCredentialManagerSignIn(call, serverClientId, forceAccountPicker);
                            }

                            @Override
                            public void onError(@NonNull ClearCredentialException exception) {
                                launchCredentialManagerSignIn(call, serverClientId, forceAccountPicker);
                            }
                        }
                    );
                } catch (Exception ex) {
                    launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
                }
            } else {
                launchCredentialManagerSignIn(call, serverClientId, forceAccountPicker);
            }
            return;
        }

        launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        try {
            CredentialManager credentialManager = CredentialManager.create(getActivity());
            credentialManager.clearCredentialStateAsync(
                new ClearCredentialStateRequest(),
                null,
                executor,
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void result) {
                        // Continue to legacy signOut
                    }

                    @Override
                    public void onError(@NonNull ClearCredentialException exception) {
                        // Ignore clear credential error
                    }
                }
            );
        } catch (Exception ignored) {
            // Ignore if CredentialManager unavailable
        }

        try {
            String serverClientId = resolveServerClientId(null);
            GoogleSignInOptions.Builder builder = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestEmail();
            if (serverClientId != null && !serverClientId.isEmpty()) {
                builder.requestIdToken(serverClientId);
            }
            GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), builder.build());
            client.signOut().addOnCompleteListener(getActivity(), task -> call.resolve());
        } catch (Exception ex) {
            call.resolve();
        }
    }

    private void launchCredentialManagerSignIn(
        @NonNull PluginCall call,
        @NonNull String serverClientId,
        boolean forceAccountPicker
    ) {
        try {
            GetSignInWithGoogleOption googleSignInOption = new GetSignInWithGoogleOption.Builder(serverClientId).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(googleSignInOption).build();
            CredentialManager credentialManager = CredentialManager.create(getActivity());
            credentialManager.getCredentialAsync(
                getActivity(),
                request,
                null,
                executor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        try {
                            Credential credential = response.getCredential();
                            if (GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                Bundle data = credential.getData();
                                GoogleIdTokenCredential googleIdTokenCredential = GoogleIdTokenCredential.createFrom(data);
                                String idToken = googleIdTokenCredential.getIdToken();
                                if (idToken == null || idToken.isEmpty()) {
                                    launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
                                    return;
                                }
                                JSObject ret = new JSObject();
                                ret.put("idToken", idToken);
                                if (googleIdTokenCredential.getId() != null) {
                                    ret.put("email", googleIdTokenCredential.getId());
                                }
                                if (googleIdTokenCredential.getDisplayName() != null) {
                                    ret.put("displayName", googleIdTokenCredential.getDisplayName());
                                }
                                if (googleIdTokenCredential.getProfilePictureUri() != null) {
                                    ret.put("photoUrl", googleIdTokenCredential.getProfilePictureUri().toString());
                                }
                                call.resolve(ret);
                                return;
                            }
                            launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
                        } catch (Exception ex) {
                            launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException exception) {
                        if (isCancelledCredentialException(exception)) {
                            call.reject("Google Sign-In cancelled.", "CANCELLED");
                            return;
                        }
                        // Fallback to classic Google Play Services account chooser
                        launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
                    }
                }
            );
        } catch (Exception ex) {
            launchLegacyGoogleSignIn(call, serverClientId, forceAccountPicker);
        }
    }

    private void launchLegacyGoogleSignIn(
        @NonNull PluginCall call,
        @NonNull String serverClientId,
        boolean forceAccountPicker
    ) {
        getActivity().runOnUiThread(() -> {
            try {
                GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(serverClientId)
                    .requestEmail()
                    .build();
                GoogleSignInClient client = GoogleSignIn.getClient(getActivity(), gso);
                if (forceAccountPicker) {
                    client
                        .signOut()
                        .addOnCompleteListener(getActivity(), task -> {
                            Intent signInIntent = client.getSignInIntent();
                            startActivityForResult(call, signInIntent, "handleGoogleSignInResult");
                        });
                } else {
                    Intent signInIntent = client.getSignInIntent();
                    startActivityForResult(call, signInIntent, "handleGoogleSignInResult");
                }
            } catch (Exception ex) {
                call.reject("Unable to launch Google Sign-In: " + ex.getMessage(), "LAUNCH_FAILED");
            }
        });
    }

    @ActivityCallback
    private void handleGoogleSignInResult(@Nullable PluginCall call, @Nullable ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null) {
            call.reject("Google Sign-In returned no result.", "NO_RESULT");
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED && result.getData() == null) {
            call.reject("Google Sign-In cancelled.", "CANCELLED");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account != null ? account.getIdToken() : null;
            if (idToken == null || idToken.isEmpty()) {
                call.reject(
                    "Google Sign-In did not return an ID token. Check Firebase OAuth client configuration.",
                    "NO_ID_TOKEN"
                );
                return;
            }
            JSObject ret = new JSObject();
            ret.put("idToken", idToken);
            if (account.getEmail() != null) {
                ret.put("email", account.getEmail());
            }
            if (account.getDisplayName() != null) {
                ret.put("displayName", account.getDisplayName());
            }
            if (account.getPhotoUrl() != null) {
                ret.put("photoUrl", account.getPhotoUrl().toString());
            }
            call.resolve(ret);
        } catch (ApiException exception) {
            int statusCode = exception.getStatusCode();
            if (statusCode == 12501 || statusCode == 16) {
                call.reject("Google Sign-In cancelled.", "CANCELLED");
                return;
            }
            if (statusCode == 10) {
                call.reject(
                    "Google Sign-In developer configuration error (code 10). Add this APK's SHA-1 & SHA-256 certificate fingerprints to Firebase Console for com.alphamate.liveparty.",
                    "10"
                );
                return;
            }
            call.reject(
                "Google Sign-In failed (code " + statusCode + "): " + exception.getMessage(),
                String.valueOf(statusCode)
            );
        }
    }

    @Nullable
    private String resolveServerClientId(@Nullable String explicitClientId) {
        if (explicitClientId != null && !explicitClientId.trim().isEmpty()) {
            return explicitClientId.trim();
        }
        try {
            int resId = getContext()
                .getResources()
                .getIdentifier("default_web_client_id", "string", getContext().getPackageName());
            if (resId != 0) {
                String value = getContext().getString(resId);
                if (value != null && !value.trim().isEmpty() && !"WILL_BE_OVERRIDDEN".equals(value.trim())) {
                    return value.trim();
                }
            }
        } catch (Exception ignored) {
            // Fall through
        }
        return null;
    }

    private boolean isCancelledCredentialException(@NonNull GetCredentialException exception) {
        String errType = exception.getType() != null ? exception.getType().toUpperCase() : "";
        String errClass = exception.getClass().getName().toLowerCase();
        String errMsg = exception.getMessage() != null ? exception.getMessage().toLowerCase() : "";
        return (
            errClass.contains("cancellation") ||
            errType.contains("CANCELED") ||
            errType.contains("CANCELLED") ||
            errMsg.contains("cancel")
        );
    }
}
