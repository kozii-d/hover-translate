type OnRetryCallback = (attempt: number, error: unknown) => void;

interface FetchOptions extends RequestInit {
  onRetry?: OnRetryCallback;
}

class ApiService {
  private readonly MAX_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

  public async fetchData<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const {
      onRetry = () => {},
      ...restOptions
    } = options;

    const config: RequestInit = {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...(restOptions?.headers || {}),
      },
    };

    const url = `${__API_URL__}${path}`;

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.MAX_ATTEMPTS) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        lastError = error;
        onRetry(attempt, error);
        attempt++;
        await this.delay(this.RETRY_DELAY_MS);
      }
    }

    throw lastError;
  }

  private async delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

export const apiService = new ApiService();