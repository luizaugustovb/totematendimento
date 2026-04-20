import { Module } from '@nestjs/common';
import { PythonRunnerService } from './python-runner.service';
import { 
  ScriptsPythonController, 
  ExecucoesPythonController,
  PythonRunnerController
} from './python-runner.controller';

@Module({
  controllers: [
    ScriptsPythonController,
    ExecucoesPythonController,
    PythonRunnerController,
  ],
  providers: [PythonRunnerService],
  exports: [PythonRunnerService],
})
export class PythonRunnerModule {}