import { Module } from '@nestjs/common';
import { GithubParserService } from './github-parser.service';
import { GithubUrlService } from './github-url.service';
@Module({ providers: [GithubParserService, GithubUrlService], exports: [GithubParserService, GithubUrlService] })
export class GithubModule {}
