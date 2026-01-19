// src/api-examples/notes-example.ts

/**
 * Example usage of the Notes API
 * This shows how to interact with the notes endpoints
 */

import { ApiResponse, PaginatedNotesResponse, CreateNoteData } from '@/types/database';

// Example: How to call the notes API endpoints
export class NotesAPIClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    // Explicitly cast headers to handle type compatibility
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get all notes for the user
  // Fix: Use PaginatedNotesResponse instead of NotesResponse
  async getNotes(): Promise<PaginatedNotesResponse> {
    const response = await this.makeRequest('/notes');
    return response.data;
  }

  // Create a new note
  async createNote(title: string, content: string): Promise<any> {
    const noteData: CreateNoteData = { title, content };
    const response = await this.makeRequest('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
    return response.data;
  }

  // Update a note
  async updateNote(id: string, updates: { title?: string; content?: string }): Promise<any> {
    const response = await this.makeRequest(`/notes?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  // Delete a note
  async deleteNote(id: string): Promise<void> {
    await this.makeRequest(`/notes?id=${id}`, {
      method: 'DELETE',
    });
  }
}

// Example usage functions
export async function exampleUsage() {
  const client = new NotesAPIClient();
  
  // You would need to get this token from your authentication system
  const authToken = 'your-supabase-jwt-token';
  client.setAuthToken(authToken);

  try {
    // Get all notes
    console.log('Fetching notes...');
    const notesData = await client.getNotes();
    console.log(`Found ${notesData.count}/${notesData.limit} notes`);
    console.log('Notes:', notesData.notes);

    // Create a new note
    console.log('Creating note...');
    const newNote = await client.createNote(
      'Sample Note',
      'This is a sample note content.'
    );
    console.log('Created note:', newNote);

    // Update the note
    console.log('Updating note...');
    const updatedNote = await client.updateNote(newNote.id, {
      title: 'Updated Sample Note',
      content: 'This note has been updated!'
    });
    console.log('Updated note:', updatedNote);

  } catch (error) {
    console.error('API Error:', error);
  }
}

// Error handling examples
export async function testLimits() {
  const client = new NotesAPIClient();
  client.setAuthToken('your-supabase-jwt-token');

  try {
    // Try to create notes beyond the free limit
    for (let i = 1; i <= 15; i++) {
      try {
        const note = await client.createNote(
          `Note ${i}`,
          `This is test note number ${i}`
        );
        console.log(`✅ Created note ${i}: ${note.title}`);
      } catch (error: any) {
        if (error.message.includes('Note limit reached')) {
          console.log(`❌ Limit reached at note ${i}: ${error.message}`);
          break;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Example: Check usage info
export async function checkUsageInfo() {
  const client = new NotesAPIClient();
  client.setAuthToken('your-supabase-jwt-token');

  try {
    const notesData = await client.getNotes();
    const { count, limit } = notesData;
    
    console.log('📊 Usage Information:');
    console.log(`Current notes: ${count}`);
    console.log(`Limit: ${limit === Infinity ? 'Unlimited (Pro)' : `${limit} (Free)`}`);
    
    if (limit !== Infinity && count >= limit) {
      console.log('⚠️ You have reached your note limit!');
    } else if (limit !== Infinity && count >= limit * 0.8) {
      console.log('⚠️ You are approaching your note limit (80%)');
    } else {
      console.log('✅ You have plenty of notes remaining');
    }
  } catch (error) {
    console.error('Error checking usage:', error);
  }
}

export default NotesAPIClient;