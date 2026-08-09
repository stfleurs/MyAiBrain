import type { KnowledgeImportance, KnowledgeType } from "@pam/shared";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          description: string | null;
          repository_url: string | null;
          tech_stack: string[];
          status: "active" | "archived" | "maintained";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          slug: string;
          description?: string | null;
          repository_url?: string | null;
          tech_stack?: string[];
          status?: "active" | "archived" | "maintained";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          repository_url?: string | null;
          tech_stack?: string[];
          status?: "active" | "archived" | "maintained";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          type: KnowledgeType;
          title: string;
          content: string;
          summary: string | null;
          source: string | null;
          importance: KnowledgeImportance;
          search_tsv: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          type: KnowledgeType;
          title: string;
          content: string;
          summary?: string | null;
          source?: string | null;
          importance?: KnowledgeImportance;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          type?: KnowledgeType;
          title?: string;
          content?: string;
          summary?: string | null;
          source?: string | null;
          importance?: KnowledgeImportance;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
        };
        Relationships: [];
      };
      knowledge_tags: {
        Row: {
          knowledge_id: string;
          tag_id: string;
        };
        Insert: {
          knowledge_id: string;
          tag_id: string;
        };
        Update: {
          knowledge_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_tags_knowledge_id_fkey";
            columns: ["knowledge_id"];
            isOneToOne: false;
            referencedRelation: "knowledge";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_embeddings: {
        Row: {
          id: string;
          knowledge_id: string;
          embedding: string | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          knowledge_id: string;
          embedding?: string | null;
          model: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          knowledge_id?: string;
          embedding?: string | null;
          model?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_embeddings_knowledge_id_fkey";
            columns: ["knowledge_id"];
            isOneToOne: false;
            referencedRelation: "knowledge";
            referencedColumns: ["id"];
          },
        ];
      };
      code_references: {
        Row: {
          id: string;
          knowledge_id: string;
          project_id: string | null;
          repository: string | null;
          file_path: string;
          symbol: string | null;
          line_start: number | null;
          line_end: number | null;
          commit_sha: string | null;
          url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          knowledge_id: string;
          project_id?: string | null;
          repository?: string | null;
          file_path: string;
          symbol?: string | null;
          line_start?: number | null;
          line_end?: number | null;
          commit_sha?: string | null;
          url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          knowledge_id?: string;
          project_id?: string | null;
          repository?: string | null;
          file_path?: string;
          symbol?: string | null;
          line_start?: number | null;
          line_end?: number | null;
          commit_sha?: string | null;
          url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "code_references_knowledge_id_fkey";
            columns: ["knowledge_id"];
            isOneToOne: false;
            referencedRelation: "knowledge";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge: {
        Args: {
          query_embedding: string;
          match_count?: number;
          owner?: string;
          filter_type?: KnowledgeType | null;
          filter_project?: string | null;
        };
        Returns: {
          knowledge_id: string;
          vector_score: number;
        }[];
      };
      search_knowledge_keyword: {
        Args: {
          search_query: string;
          owner: string;
          max_count?: number;
          filter_type?: KnowledgeType | null;
          filter_project?: string | null;
          filter_tags?: string[] | null;
        };
        Returns: {
          knowledge_id: string;
          keyword_score: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
