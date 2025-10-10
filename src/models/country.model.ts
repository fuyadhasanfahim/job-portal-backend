import { model, Schema } from 'mongoose';

const CountrySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
    },
    {
        timestamps: true,
    },
);

const CountryModel = model('Country', CountrySchema);
export default CountryModel;
