export class EWMA
{
    private smoothingFactor: number;
    private value_: number;
    private initialValue: number;

    public constructor(smoothingFactor: number, initialValue: number = 0)
    {
        this.smoothingFactor = smoothingFactor;
        this.value_ = initialValue;
        this.initialValue = initialValue;
    }

    public update(current: number): number
    {
        this.value_ = this.smoothingFactor * current + (1-this.smoothingFactor) * this.value_;
        return this.value_;
    }

    public reset()
    {
        this.value_ = this.initialValue;
    }

    public get value(): number
    {
        return this.value_;
    }
}
