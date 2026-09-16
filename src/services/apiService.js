import axios from "axios";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { protectedResources } from "../authConfig";

const apiClient = axios.create({
  baseURL: protectedResources.bffApi.endpoint,
});

async function acquireApiToken(msalInstance, account) {
  const request = {
    scopes: protectedResources.bffApi.scopes,
    account,
  };

  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.idToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup(request);
      return result.idToken;
    }
    throw error;
  }
}

export async function callBffApi(msalInstance, account, config) {
  const token = await acquireApiToken(msalInstance, account);

  return apiClient({
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getHealth(msalInstance, account) {
  const response = await callBffApi(msalInstance, account, {
    method: "GET",
    url: "/health",
  });
  return response.data;
}