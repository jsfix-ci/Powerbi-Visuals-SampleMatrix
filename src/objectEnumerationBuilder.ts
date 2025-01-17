/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/**
 * A helper class for building a VisualObjectInstanceEnumerationObject:
 * - Allows call chaining (e.g., builder.pushInstance({...}).pushInstance({...})
 * - Allows creating of containers (via pushContainer/popContainer)
 */

import * as _ from "lodash";
import powerbi from "powerbi-visuals-api";
import { Selector } from "./common";
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceContainer = powerbi.VisualObjectInstanceContainer;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;

export class ObjectEnumerationBuilder {
    private instances: VisualObjectInstance[];
    private containers: VisualObjectInstanceContainer[];
    private containerIdx: number;

    public pushInstance(instance: VisualObjectInstance, mergeInstances: boolean = true): ObjectEnumerationBuilder {

        let instances = this.instances;
        if (!instances) {
            instances = this.instances = [];
        }

        const containerIdx = this.containerIdx;
        if (containerIdx != null) {
            instance.containerIdx = containerIdx;
        }

        if (mergeInstances) {
            // Attempt to merge with an existing item if possible.
            for (const existingInstance of instances) {
                if (this.canMerge(existingInstance, instance)) {
                    this.extend(existingInstance, instance, 'properties');
                    this.extend(existingInstance, instance, 'validValues');

                    return this;
                }
            }
        }

        instances.push(instance);

        return this;
    }

    public pushContainer(container: VisualObjectInstanceContainer): ObjectEnumerationBuilder {

        let containers = this.containers;
        if (!containers) {
            containers = this.containers = [];
        }

        const updatedLen = containers.push(container);
        this.containerIdx = updatedLen - 1;

        return this;
    }

    public popContainer(): ObjectEnumerationBuilder {
        this.containerIdx = undefined;

        return this;
    }

    public complete(): VisualObjectInstanceEnumerationObject {
        if (!this.instances)
            return;

        const result: VisualObjectInstanceEnumerationObject = {
            instances: this.instances,
        };

        const containers = this.containers;
        if (containers) {
            result.containers = containers;
        }

        return result;
    }

    private canMerge(x: VisualObjectInstance, y: VisualObjectInstance): boolean {

        return x.objectName === y.objectName &&
            x.containerIdx === y.containerIdx &&
            ObjectEnumerationBuilder.selectorEquals(x.selector, y.selector);
    }

    private extend(target: VisualObjectInstance, source: VisualObjectInstance, propertyName: string): void {

        const sourceValues = source[propertyName];
        if (!sourceValues)
            return;

        let targetValues = target[propertyName];
        if (!targetValues)
            targetValues = target[propertyName] = {};

        for (const valuePropertyName in sourceValues) {
            if (targetValues[valuePropertyName]) {
                // Properties have first-writer-wins semantics.
                continue;
            }

            targetValues[valuePropertyName] = sourceValues[valuePropertyName];
        }
    }

    public static merge(x: VisualObjectInstanceEnumeration, y: VisualObjectInstanceEnumeration): VisualObjectInstanceEnumerationObject {
        const xNormalized = ObjectEnumerationBuilder.normalize(x);
        const yNormalized = ObjectEnumerationBuilder.normalize(y);

        if (!xNormalized || !yNormalized)
            return xNormalized || yNormalized;

        const xCategoryCount = xNormalized.containers ? xNormalized.containers.length : 0;

        for (const yInstance of yNormalized.instances) {
            xNormalized.instances.push(yInstance);

            if (yInstance.containerIdx != null)
                yInstance.containerIdx += xCategoryCount;
        }

        const yContainers = yNormalized.containers;
        if (!_.isEmpty(yContainers)) {
            if (xNormalized.containers)
                Array.prototype.push.apply(xNormalized.containers, yContainers);
            else
                xNormalized.containers = yContainers;
        }

        return xNormalized;
    }

    public static normalize(x: VisualObjectInstanceEnumeration): VisualObjectInstanceEnumerationObject {

        if (_.isArray(x)) {
            return { instances: <VisualObjectInstance[]>x };
        }

        return <VisualObjectInstanceEnumerationObject>x;
    }

    public static getContainerForInstance(enumeration: VisualObjectInstanceEnumerationObject, instance: VisualObjectInstance): VisualObjectInstanceContainer {
        return enumeration.containers[instance.containerIdx];
    }

    public static selectorEquals(x: Selector, y: Selector): boolean {
        // Normalize false to null
        x = x || null;
        y = y || null;

        if (x === y)
            return true;

        if (!x !== !y)
            return false;

        if (x.id !== y.id)
            return false;
        if (x.metadata !== y.metadata)
            return false;

        return true;
    }
}


