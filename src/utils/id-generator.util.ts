/**
 * Utility functions for generating unique IDs used throughout the application
 */

/**
 * Generates a unique client ID for WebSocket connections
 * Format: client_[timestamp]_[random string]
 * 
 * @returns {string} A unique client identifier
 */
export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Extracts the client ID from a WebSocket client object
 * Falls back to socket remote address if _clientId is not set
 * 
 * @param client The WebSocket client object
 * @returns {string} The client ID or a fallback ID
 */
export function getClientIdFromSocket(client: any): string {
  return client._clientId || client._socket?.remoteAddress || generateClientId();
} 