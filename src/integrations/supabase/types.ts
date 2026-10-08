export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_job_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          job_id: string
          metadata_json: Json
          status: string
          step_number: number
          step_type: string
          summary: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          metadata_json?: Json
          status?: string
          step_number: number
          step_type: string
          summary?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          metadata_json?: Json
          status?: string
          step_number?: number
          step_type?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jobs: {
        Row: {
          completed_at: string | null
          conversation_id: string | null
          cost_estimate: number | null
          created_at: string
          current_step: number
          error_code: string | null
          id: string
          mode: string
          orchestration: Json | null
          plan_json: Json
          progress: number
          project_id: string
          request_text: string
          requires_approval: boolean
          result_summary: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          conversation_id?: string | null
          cost_estimate?: number | null
          created_at?: string
          current_step?: number
          error_code?: string | null
          id?: string
          mode?: string
          orchestration?: Json | null
          plan_json?: Json
          progress?: number
          project_id: string
          request_text: string
          requires_approval?: boolean
          result_summary?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          conversation_id?: string | null
          cost_estimate?: number | null
          created_at?: string
          current_step?: number
          error_code?: string | null
          id?: string
          mode?: string
          orchestration?: Json | null
          plan_json?: Json
          progress?: number
          project_id?: string
          request_text?: string
          requires_approval?: boolean
          result_summary?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          capabilities_json: Json
          context_length: number | null
          created_at: string
          display_name: string
          external_model_id: string
          id: string
          is_available: boolean
          last_checked_at: string | null
          metadata_json: Json
          price_class: string
          provider_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capabilities_json?: Json
          context_length?: number | null
          created_at?: string
          display_name: string
          external_model_id: string
          id?: string
          is_available?: boolean
          last_checked_at?: string | null
          metadata_json?: Json
          price_class?: string
          provider_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capabilities_json?: Json
          context_length?: number | null
          created_at?: string
          display_name?: string
          external_model_id?: string
          id?: string
          is_available?: boolean
          last_checked_at?: string | null
          metadata_json?: Json
          price_class?: string
          provider_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          base_url: string
          created_at: string
          encrypted_secret_ref: string | null
          id: string
          last_checked_at: string | null
          name: string
          provider_type: string
          status: string
          token_hint: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url: string
          created_at?: string
          encrypted_secret_ref?: string | null
          id?: string
          last_checked_at?: string | null
          name: string
          provider_type?: string
          status?: string
          token_hint?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string
          created_at?: string
          encrypted_secret_ref?: string | null
          id?: string
          last_checked_at?: string | null
          name?: string
          provider_type?: string
          status?: string
          token_hint?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event: string
          id: string
          job_id: string | null
          metadata: Json
          model_id: string | null
          provider_id: string | null
          request_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event: string
          id?: string
          job_id?: string | null
          metadata?: Json
          model_id?: string | null
          provider_id?: string | null
          request_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event?: string
          id?: string
          job_id?: string | null
          metadata?: Json
          model_id?: string | null
          provider_id?: string | null
          request_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      approvals: {
        Row: {
          action_type: string
          change_set_id: string | null
          created_at: string
          decided_at: string | null
          executed_at: string | null
          expires_at: string
          id: string
          job_id: string | null
          payload_json: Json
          risk_level: string
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          action_type: string
          change_set_id?: string | null
          created_at?: string
          decided_at?: string | null
          executed_at?: string | null
          expires_at?: string
          id?: string
          job_id?: string | null
          payload_json?: Json
          risk_level?: string
          status?: string
          summary: string
          user_id: string
        }
        Update: {
          action_type?: string
          change_set_id?: string | null
          created_at?: string
          decided_at?: string | null
          executed_at?: string | null
          expires_at?: string
          id?: string
          job_id?: string | null
          payload_json?: Json
          risk_level?: string
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata_json: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata_json?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      change_sets: {
        Row: {
          branch_name: string | null
          commit_sha: string | null
          created_at: string
          diff_text: string
          files_changed_json: Json
          id: string
          job_id: string | null
          pr_url: string | null
          project_id: string
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          branch_name?: string | null
          commit_sha?: string | null
          created_at?: string
          diff_text?: string
          files_changed_json?: Json
          id?: string
          job_id?: string | null
          pr_url?: string | null
          project_id: string
          status?: string
          summary?: string
          user_id: string
        }
        Update: {
          branch_name?: string | null
          commit_sha?: string | null
          created_at?: string
          diff_text?: string
          files_changed_json?: Json
          id?: string
          job_id?: string | null
          pr_url?: string | null
          project_id?: string
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_sets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memory: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          scope: string
          scope_id: string | null
          source: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope: string
          scope_id?: string | null
          source: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope?: string
          scope_id?: string | null
          source?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          active_model_id: string | null
          active_provider_id: string | null
          created_at: string
          id: string
          routing_mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_model_id?: string | null
          active_provider_id?: string | null
          created_at?: string
          id?: string
          routing_mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_model_id?: string | null
          active_provider_id?: string | null
          created_at?: string
          id?: string
          routing_mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_active_model_id_fkey"
            columns: ["active_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_active_provider_id_fkey"
            columns: ["active_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          id: string
          key: string
          scope: string
          target: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          key: string
          scope?: string
          target?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          key?: string
          scope?: string
          target?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      github_connections: {
        Row: {
          account_id: number | null
          account_login: string
          auth_type: string
          created_at: string
          id: string
          installation_id: string | null
          last_checked_at: string | null
          scopes: string | null
          status: string
          token_hint: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: number | null
          account_login: string
          auth_type?: string
          created_at?: string
          id?: string
          installation_id?: string | null
          last_checked_at?: string | null
          scopes?: string | null
          status?: string
          token_hint?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: number | null
          account_login?: string
          auth_type?: string
          created_at?: string
          id?: string
          installation_id?: string | null
          last_checked_at?: string | null
          scopes?: string | null
          status?: string
          token_hint?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      github_credentials: {
        Row: {
          ciphertext: string
          connection_id: string
          created_at: string
          id: string
          key_version: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          connection_id: string
          created_at?: string
          id?: string
          key_version: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          connection_id?: string
          created_at?: string
          id?: string
          key_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "github_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      github_repositories: {
        Row: {
          connection_id: string
          created_at: string
          default_branch: string
          description: string | null
          full_name: string
          github_repo_id: number
          id: string
          is_private: boolean
          permissions_json: Json
          pushed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          default_branch?: string
          description?: string | null
          full_name: string
          github_repo_id: number
          id?: string
          is_private?: boolean
          permissions_json?: Json
          pushed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          default_branch?: string
          description?: string | null
          full_name?: string
          github_repo_id?: number
          id?: string
          is_private?: boolean
          permissions_json?: Json
          pushed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_repositories_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "github_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_registry: {
        Row: {
          id: string
          integration_key: string
          metadata_json: Json
          ref_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          integration_key: string
          metadata_json?: Json
          ref_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          integration_key?: string
          metadata_json?: Json
          ref_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kill_switches: {
        Row: {
          enabled: boolean
          key: string
          reason: string | null
          target: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          reason?: string | null
          target?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          reason?: string | null
          target?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mcp_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          credential_type: string
          expires_at: string | null
          id: string
          key_version: string
          scopes: string | null
          server_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          credential_type: string
          expires_at?: string | null
          id?: string
          key_version: string
          scopes?: string | null
          server_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          credential_type?: string
          expires_at?: string | null
          id?: string
          key_version?: string
          scopes?: string | null
          server_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_credentials_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: true
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_oauth_states: {
        Row: {
          client_id: string
          client_secret_enc: string | null
          code_verifier_enc: string
          created_at: string
          expires_at: string
          id: string
          issuer: string
          redirect_uri: string
          scope: string | null
          server_id: string
          state: string
          token_endpoint: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          client_secret_enc?: string | null
          code_verifier_enc: string
          created_at?: string
          expires_at: string
          id?: string
          issuer: string
          redirect_uri: string
          scope?: string | null
          server_id: string
          state: string
          token_endpoint: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          client_secret_enc?: string | null
          code_verifier_enc?: string
          created_at?: string
          expires_at?: string
          id?: string
          issuer?: string
          redirect_uri?: string
          scope?: string | null
          server_id?: string
          state?: string
          token_endpoint?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_states_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_prompts: {
        Row: {
          arguments_json: Json
          created_at: string
          description: string | null
          id: string
          name: string
          server_id: string
          user_id: string
        }
        Insert: {
          arguments_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          server_id: string
          user_id: string
        }
        Update: {
          arguments_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_prompts_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mime_type: string | null
          name: string | null
          server_id: string
          uri: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mime_type?: string | null
          name?: string | null
          server_id: string
          uri: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mime_type?: string | null
          name?: string | null
          server_id?: string
          uri?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_resources_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          auth_type: string
          created_at: string
          id: string
          last_checked_at: string | null
          last_error_code: string | null
          name: string
          oauth_metadata_json: Json
          server_info_json: Json
          status: string
          transport: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          auth_type?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          name: string
          oauth_metadata_json?: Json
          server_info_json?: Json
          status?: string
          transport?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          name?: string
          oauth_metadata_json?: Json
          server_info_json?: Json
          status?: string
          transport?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_tools: {
        Row: {
          approval_required: boolean
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          input_schema_json: Json
          name: string
          risk_level: string
          server_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_required?: boolean
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          input_schema_json?: Json
          name: string
          risk_level?: string
          server_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_required?: boolean
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          input_schema_json?: Json
          name?: string
          risk_level?: string
          server_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tools_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata_json: Json
          model_id: string | null
          provider_id: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata_json?: Json
          model_id?: string | null
          provider_id?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata_json?: Json
          model_id?: string | null
          provider_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_chunks: {
        Row: {
          chunk_index: number
          content: string
          embedding: Json | null
          file_id: string
          id: string
          metadata_json: Json
          project_id: string
          start_line: number
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          embedding?: Json | null
          file_id: string
          id?: string
          metadata_json?: Json
          project_id: string
          start_line?: number
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          embedding?: Json | null
          file_id?: string
          id?: string
          metadata_json?: Json
          project_id?: string
          start_line?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          extension: string | null
          file_name: string
          id: string
          is_binary: boolean
          language: string | null
          line_count: number
          metadata_json: Json
          mime_type: string | null
          path: string
          project_id: string
          sha256: string | null
          size_bytes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extension?: string | null
          file_name: string
          id?: string
          is_binary?: boolean
          language?: string | null
          line_count?: number
          metadata_json?: Json
          mime_type?: string | null
          path: string
          project_id: string
          sha256?: string | null
          size_bytes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extension?: string | null
          file_name?: string
          id?: string
          is_binary?: boolean
          language?: string | null
          line_count?: number
          metadata_json?: Json
          mime_type?: string | null
          path?: string
          project_id?: string
          sha256?: string | null
          size_bytes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memory: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          scope: string
          scope_id: string | null
          source: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope: string
          scope_id?: string | null
          source: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope?: string
          scope_id?: string | null
          source?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_symbols: {
        Row: {
          end_line: number | null
          file_id: string
          id: string
          metadata_json: Json
          name: string
          project_id: string
          qualified_name: string | null
          start_line: number
          symbol_type: string
          user_id: string
        }
        Insert: {
          end_line?: number | null
          file_id: string
          id?: string
          metadata_json?: Json
          name: string
          project_id: string
          qualified_name?: string | null
          start_line: number
          symbol_type: string
          user_id: string
        }
        Update: {
          end_line?: number | null
          file_id?: string
          id?: string
          metadata_json?: Json
          name?: string
          project_id?: string
          qualified_name?: string | null
          start_line?: number
          symbol_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_symbols_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_symbols_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          error_code: string | null
          file_count: number
          framework_summary: Json
          id: string
          language_summary: Json
          name: string
          repository_id: string | null
          size_bytes: number
          source_type: string
          status: string
          updated_at: string
          user_id: string
          workspace_ref: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          file_count?: number
          framework_summary?: Json
          id?: string
          language_summary?: Json
          name: string
          repository_id?: string | null
          size_bytes?: number
          source_type?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_ref?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          file_count?: number
          framework_summary?: Json
          id?: string
          language_summary?: Json
          name?: string
          repository_id?: string | null
          size_bytes?: number
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_repository_fk"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "github_repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_health_checks: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          provider_id: string
          safe_error_code: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          provider_id: string
          safe_error_code?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          provider_id?: string
          safe_error_code?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_health_checks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_secrets: {
        Row: {
          ciphertext: string
          created_at: string
          id: string
          key_version: string
          provider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          id?: string
          key_version: string
          provider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          id?: string
          key_version?: string
          provider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_secrets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_workspaces: {
        Row: {
          base_branch: string
          base_sha: string | null
          created_at: string
          id: string
          project_id: string
          repository_id: string
          runtime_workspace_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_branch: string
          base_sha?: string | null
          created_at?: string
          id?: string
          project_id: string
          repository_id: string
          runtime_workspace_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_branch?: string
          base_sha?: string | null
          created_at?: string
          id?: string
          project_id?: string
          repository_id?: string
          runtime_workspace_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_workspaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repository_workspaces_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "github_repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_preferences: {
        Row: {
          fallback_enabled: boolean
          id: string
          mode: string
          preferred_model_id: string | null
          preferred_provider_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          fallback_enabled?: boolean
          id?: string
          mode?: string
          preferred_model_id?: string | null
          preferred_provider_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          fallback_enabled?: boolean
          id?: string
          mode?: string
          preferred_model_id?: string | null
          preferred_provider_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_preferences_preferred_model_id_fkey"
            columns: ["preferred_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_preferences_preferred_provider_id_fkey"
            columns: ["preferred_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_memory: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          scope: string
          scope_id: string | null
          source: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope: string
          scope_id?: string | null
          source: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope?: string
          scope_id?: string | null
          source?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          estimated_cost: number | null
          event_type: string
          id: string
          input_tokens: number | null
          model_id: string | null
          output_tokens: number | null
          provider_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost?: number | null
          event_type: string
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          provider_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost?: number | null
          event_type?: string
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          provider_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences_memory: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          scope: string
          scope_id: string | null
          source: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope: string
          scope_id?: string | null
          source: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          scope?: string
          scope_id?: string | null
          source?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value_json: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value_json?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value_json?: Json
        }
        Relationships: []
      }
      validation_runs: {
        Row: {
          command_label: string
          created_at: string
          duration_ms: number | null
          id: string
          job_id: string
          output_excerpt: string | null
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          command_label: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          job_id: string
          output_excerpt?: string | null
          status: string
          summary?: string
          user_id: string
        }
        Update: {
          command_label?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          job_id?: string
          output_excerpt?: string | null
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "AUDITOR" | "READ_ONLY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["SUPER_ADMIN", "ADMIN", "SUPPORT", "AUDITOR", "READ_ONLY"],
    },
  },
} as const
