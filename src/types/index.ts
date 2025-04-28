/**
 * Types principaux pour l'application FHIRHub
 */

// Type pour une Application
export interface Application {
  id: number;
  name: string;
  type?: string;
  description?: string;
  is_active: boolean;
  properties?: Record<string, string>;
  cors_domain?: string;
  created_at: string;
  updated_at: string;
}

// Type pour la création d'une nouvelle Application
export interface CreateApplicationDto {
  name: string;
  type?: string;
  description?: string;
  is_active?: boolean;
  properties?: Record<string, string>;
  cors_domain?: string;
}

// Type pour la mise à jour d'une Application
export interface UpdateApplicationDto {
  name?: string;
  type?: string;
  description?: string;
  is_active?: boolean;
  properties?: Record<string, string>;
  cors_domain?: string;
}

// Type pour une clé API
export interface ApiKey {
  id: number;
  application_id: number;
  key: string;
  hashed_key: string;
  created_at: string;
  last_used_at: string | null;
  is_revoked: boolean;
}

// Type pour le journal de conversion
export interface ConversionLog {
  id: number;
  api_key_id: number;
  source_type: string;
  source_content: string;
  result_content: string;
  status: 'success' | 'error';
  error_message?: string;
  processing_time: number; // en millisecondes
  created_at: string;
}

// Type pour la réponse d'API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Type pour étendre la requête Express avec des informations sur l'API key
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      application?: Application;
    }
  }
}