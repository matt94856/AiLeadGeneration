export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  messageId: string;
}

export interface IEmailService {
  isConfigured(): boolean;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
