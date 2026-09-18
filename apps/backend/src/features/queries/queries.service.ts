import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Query, QueryDocument } from './queries.schema';
import type { RepositorySnapshot, ResearchConfig } from '../github/github.types';

export interface CreateQueryDto {
  prompt: string;
  plan: ResearchConfig;
  repositories: RepositorySnapshot[];
  report: Record<string, unknown>;
  monitorId?: string;
  runType?: 'manual' | 'scheduled' | 'manual-monitor';
}
@Injectable()
export class QueriesService {
  constructor(@InjectModel(Query.name) private readonly queryModel: Model<QueryDocument>) {}
  async create(dto: CreateQueryDto) { return new this.queryModel(dto).save(); }
  async findAll() { return this.queryModel.find().select('-repositories').sort({ createdAt: -1 }).exec(); }
  async findRecentHistory(prompt: string, monitorId?: string, limit = 8) {
    const escaped = prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = monitorId ? { monitorId } : { prompt: { $regex: `^${escaped}$`, $options: 'i' } };
    return this.queryModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
  }
  async findOne(id: string) { const q = await this.queryModel.findById(id).exec(); if (!q) throw new NotFoundException(`Query ${id} not found`); return q; }
  async remove(id: string) { const q = await this.queryModel.findByIdAndDelete(id).exec(); if (!q) throw new NotFoundException(`Query ${id} not found`); }
}
