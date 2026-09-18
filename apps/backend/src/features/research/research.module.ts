import { Module } from '@nestjs/common';
import { DecodoModule } from '../decodo/decodo.module';
import { GithubModule } from '../github/github.module';
import { LlmModule } from '../llm/llm.module';
import { QueriesModule } from '../queries/queries.module';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
@Module({ imports: [DecodoModule, GithubModule, LlmModule, QueriesModule], controllers: [ResearchController], providers: [ResearchService], exports: [ResearchService] })
export class ResearchModule {}
