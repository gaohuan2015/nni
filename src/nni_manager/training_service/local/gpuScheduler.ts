/**
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

import { delay } from '../../common/utils';
import { GPUInfo, GPUSummary } from '../common/gpuData';
import { getLogger, Logger } from '../../common/log';
import * as cp from 'child_process';
import * as cpp from 'child-process-promise';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { String } from 'typescript-string-operations';
import { execMkdir, getScriptName, getgpuMetricsCollectorScriptContent, execScript, execTail, execRemove } from '../common/util'

/**
 * GPUScheduler
 */
class GPUScheduler {

    private gpuSummary!: GPUSummary;
    private stopping: boolean;
    private log: Logger;
    private gpuMetricCollectorScriptFolder: string;

    constructor() {
        this.stopping = false;
        this.log = getLogger();
        this.gpuMetricCollectorScriptFolder = `${os.tmpdir()}/nni/script`;
    }

    public async run(): Promise<void> {
        await this.runGpuMetricsCollectorScript();
        while (!this.stopping) {
            try {
                await this.updateGPUSummary();
            } catch (error) {
                this.log.error('Read GPU summary failed with error: ', error);
            }
            await delay(5000);
        }
    }

    /**
     * Generate gpu metric collector shell script in local machine, 
     * used to run in remote machine, and will be deleted after uploaded from local. 
     */
    private async runGpuMetricsCollectorScript(): Promise<void> {
        await execMkdir(this.gpuMetricCollectorScriptFolder);
        //generate gpu_metrics_collector script
        let gpuMetricsCollectorScriptPath: string = path.join(this.gpuMetricCollectorScriptFolder, getScriptName('gpu_metrics_collector'));
        const gpuMetricsCollectorScriptContent: string = getgpuMetricsCollectorScriptContent(this.gpuMetricCollectorScriptFolder);
        console.log(this.gpuMetricCollectorScriptFolder)
        console.log(gpuMetricsCollectorScriptContent)
        await fs.promises.writeFile(gpuMetricsCollectorScriptPath, gpuMetricsCollectorScriptContent, { encoding: 'utf8' });
        execScript(gpuMetricsCollectorScriptPath)
        console.log('----------------74----------')
    }

    public getAvailableGPUIndices(): number[] {
        if (this.gpuSummary !== undefined) {
            return this.gpuSummary.gpuInfos.filter((info: GPUInfo) => info.activeProcessNum === 0).map((info: GPUInfo) => info.index);
        }

        return [];
    }

    public async stop() {
        this.stopping = true;
        try {
            const pid: string = await fs.promises.readFile(path.join(this.gpuMetricCollectorScriptFolder, 'pid'), 'utf8');
            await cpp.exec(`pkill -P ${pid}`);
            await execRemove(this.gpuMetricCollectorScriptFolder);
        } catch (error){
            this.log.error(`GPU scheduler error: ${error}`);
        }
    }

    private async updateGPUSummary() {
        console.log('----------------97----------')
        const cmdresult = await execTail(path.join(this.gpuMetricCollectorScriptFolder, 'gpu_metrics'));
        console.log('----------------99----------')
        if(cmdresult && cmdresult.stdout) {
            console.log('----------------101----------')
            console.log(cmdresult.stdout)
            this.gpuSummary = <GPUSummary>JSON.parse(cmdresult.stdout);
            console.log(this.gpuSummary)
        } else {
            this.log.error('Could not get gpu metrics information!');
        }
    }
}

export { GPUScheduler };
