import axios from 'axios';
import type { AIVideoComposition, AIGenerationRequest } from '@/types/ai-video';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class AIVideoApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async generateComposition(request: AIGenerationRequest): Promise<AIVideoComposition> {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai-video/generate`,
      request,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async saveComposition(composition: AIVideoComposition): Promise<{ id: string }> {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai-video/compositions`,
      composition,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async getComposition(id: string): Promise<AIVideoComposition> {
    const response = await axios.get(
      `${API_BASE_URL}/api/ai-video/compositions/${id}`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async listCompositions(): Promise<AIVideoComposition[]> {
    const response = await axios.get(
      `${API_BASE_URL}/api/ai-video/compositions`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async deleteComposition(id: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/api/ai-video/compositions/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }
}

export const aiVideoApi = new AIVideoApiService();
