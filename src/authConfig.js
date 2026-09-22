export const msalConfig = {
    auth: {
        clientId: process.env.REACT_APP_CLIENT_ID,
        authority: `https://CleanFreshChain.ciamlogin.com/${process.env.REACT_APP_TENANT_ID}/v2.0`,
        knownAuthorities: [`CleanFreshChain.ciamlogin.com`],
        redirectUri: `${window.location.origin}/redirect.html`,
        postLogoutRedirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    }
};

export const loginRequest = {
    scopes: ["openid", "profile", "User.Read"]
};

export const protectedResources = {
    bffApi: {
        endpoint: "http://localhost:8080/api",
        scopes: ["User.Read"],
    },
};